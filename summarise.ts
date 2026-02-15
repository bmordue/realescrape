import { readFileSync } from 'fs';
import { PropertyResult } from './app';
import { config } from "dotenv";
import fetch from 'node-fetch';

config();

import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function main() {
    try {
        await summariseHouseResults();
        console.log('Successfully completed property analysis.');
    } catch (error) {
        console.error('Fatal error during analysis:', error);
        process.exit(1);
    }
}

function firstN(el: any, index: number, array: any) {
    //return true;
    return index < 200;
}

async function summariseHouseResults() {
    try {
        const houseResults: PropertyResult[] = JSON.parse(readFileSync("results-sspc-House.json", { encoding: "utf-8" }));
        console.log(`Parsed ${houseResults.length} results.`);
        // TODO: start with first ten, expand from there
        await Promise.all(houseResults.filter(firstN).map(summariseResult));
    } catch (error) {
        console.error('Error reading or processing house results:', error);
        throw error;
    }
}

async function summariseResult(property: PropertyResult, index: number, array: PropertyResult[]): Promise<PropertyResult> {
    const partialPrompt = "Does this document describe a Victorian property? Reply with only Yes, No or Maybe. Try to use Maybe as little as possible.";

    try {
        if (property.url) {
            const listing = await fetch(property.url);
            if (!listing.ok) {
                throw new Error(`HTTP error! status: ${listing.status}`);
            }
            const listingText = await listing.text();
            const fullPrompt = partialPrompt + '\n\n' + listingText;

            const chatCompletion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: fullPrompt }],
                model: 'gpt-3.5-turbo',
            });

            property.addedData = { summary: chatCompletion.choices[0] };
            const trimmedPrice: number = parseInt(property.priceDescription.split('£')[1]?.replace(',', '') || '0');
            const thumbsUp = chatCompletion.choices[0]?.message?.content?.includes("Yes");
            if (thumbsUp) {
                console.log(`${property.url} (${trimmedPrice})`);
            }
        }
    } catch (error) {
        console.error(`Failed to analyze property ${property.url}:`, error);
        // Continue processing other properties even if one fails
        property.addedData = { 
            summary: { 
                message: { content: 'Analysis failed' }, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            } 
        };
    }
    return property;
}


main();