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

## Development Environment

This project includes a Nix development environment (`shell.nix`) that provides:
- Node.js 16 (matching the CI environment)
- npm package manager
- TypeScript compiler and language server
- Git version control
- Automatic environment setup with helpful aliases (`build`, `dev`)

The Nix environment ensures all developers have identical tooling, eliminating "works on my machine" issues.

## Installation

### Option 1: Using Nix (Recommended)

[Nix](https://nixos.org/) provides a reproducible development environment with all required dependencies.

1. **Install Nix** (if not already installed):
   ```bash
   curl -L https://nixos.org/nix/install | sh
   ```

2. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd realescrape
   ```

3. **Enter the Nix shell:**
   ```bash
   nix-shell
   ```
   This will automatically set up Node.js 16, npm, TypeScript, and all development tools.

4. **Install npm dependencies:**
   ```bash
   npm install
   ```

#### Optional: Use direnv for automatic environment loading

If you have [direnv](https://direnv.net/) installed, the environment will automatically activate when you enter the project directory:

```bash
# Allow direnv for this directory
direnv allow
```

### Option 2: Manual Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   ```
2. **Install Node.js 16** (required version)

3. **Install dependencies:**
   ```bash
   npm install
   ```

## Usage

> **Tip**: If using Nix shell, you can use the `build` alias instead of `npx tsc` and `dev` alias instead of `npm start`.

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

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit the `.env` file and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```
   You can get an API key from [OpenAI's platform](https://platform.openai.com/api-keys).

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
