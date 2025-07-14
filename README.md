# RealEstate Scraper & AI Summarizer

A web scraping tool to extract property listings from real estate websites, with an AI-powered summarization feature to identify specific property characteristics.

## Description

This project scrapes property listings from `sspc.co.uk`, saves the data, and then uses the OpenAI API to analyze the property descriptions. The primary goal is to identify properties with specific features, such as "Victorian" architecture, from the scraped data.

## Features

- Scrapes property listings for Houses, Flats, and Bungalows.
- Saves individual property pages for offline access.
- Extracts key information like address, price, and summary.
- Uses OpenAI's GPT-3.5-turbo to analyze and classify properties based on their description.
- Configurable and extensible for other real estate websites and property features.

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```

## Usage

1. **Compile the TypeScript files:**
   ```bash
   npx tsc
   ```
2. **Run the scraper:**
   ```bash
   npm start
   ```
   This will fetch the property listings and create the `results-*.json` files and `properties` directory.

3. **Run the AI summarizer:**
   ```bash
   node built/summarise.js
   ```
   This will analyze the scraped data and output the URLs and prices of properties identified as "Victorian".

## Configuration

To use the AI summarization feature, you need to have an OpenAI API key.

1. Create a `.env` file in the root of the project.
2. Add your OpenAI API key to the `.env` file:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```
The `summarise.ts` script uses `dotenv` to load the API key from the `.env` file.

---

## Old description

# Read me!

`curl https://espc.com/properties?p=1&ps=5&new=7`

Look for XHR to /list

DevTools copy as Fetch in console:

```
await fetch("https://espc.com/properties/search/list", {
    "credentials": "include",
    "headers": {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:95.0) Gecko/20100101 Firefox/95.0",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/json;charset=utf-8",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
    },
    "referrer": "https://espc.com/properties?p=3&ps=5&new=7",
    "body": "{\"page\":3,\"pageSize\":5,\"sortBy\":null,\"locations\":[{\"displayText\":\"Scotland\",\"key\":\"scotland\",\"category\":0}],\"radiuses\":[],\"school\":null,\"rental\":false,\"minBeds\":\"\",\"minPrice\":\"\",\"maxPrice\":\"\",\"new\":7,\"fixedPrice\":false,\"virtualTour\":false,\"underOffer\":false,\"featured\":false,\"exclusive\":false,\"orgId\":null,\"ptype\":[],\"freeText\":[],\"view\":\"list\",\"keywords\":[],\"epc\":[],\"sids\":[]}",
    "method": "POST",
    "mode": "cors"
});
```
