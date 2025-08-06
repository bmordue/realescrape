# Project Roadmap: Suggestions for Improvement

This document outlines potential areas for improvement for the RealEstate Scraper & AI Summarizer project. The suggestions are categorized to provide a clear path for enhancing the project's functionality, maintainability, and efficiency.

## 1. Project Structure & Dependencies

The project has a solid foundation, but a few structural improvements could make it more robust and easier to maintain.

- **Dependency Audit & Update**: Some npm packages are outdated (e.g., `typescript`, `node-fetch`). A full audit of dependencies and an update to the latest stable versions would bring in security patches, performance improvements, and new features. This may require some code adjustments (e.g., for ES Modules).
- **Code Organization**: Consolidate the core logic. `app.ts` and `summarise.ts` could be refactored into modules that are orchestrated by a single main script. This would improve clarity and make the execution flow easier to follow.
- **Linting and Formatting**: Introduce tools like ESLint and Prettier to enforce a consistent code style. This is crucial for maintaining code quality, especially as the project grows.

## 2. Scraping Logic (`app.ts`)

The scraper is functional but could be more resilient and flexible.

- **Robust Error Handling**: Implement comprehensive error handling in `app.ts`. This should include try-catch blocks for network requests and parsing logic, with a retry mechanism for transient network errors. This will prevent the scraper from crashing if a single request fails or if the website's structure changes slightly.
- **Configuration File**: Hardcoded values like property types (`['House', 'Flat', 'Bungalow']`) and the target URL (`sspc.co.uk`) should be moved to a dedicated configuration file (e.g., `config.json`). This would make the scraper easier to configure and extend for other property types or websites.
- **Investigate a JSON API**: The `README.md` hints at the existence of a JSON API on `espc.com`. It's worth investigating if `sspc.co.uk` has a similar API. Switching from HTML scraping to a JSON API would be significantly more efficient and less prone to breaking when the website's layout changes.

## 3. AI Summarization (`summarise.ts`)

The AI summarization feature is a powerful concept, but the current implementation is inefficient and limited.

- **Use Local Data**: The `summarise.ts` script should read the already downloaded HTML content from the `properties/` directory instead of re-fetching each URL. This will make the script much faster and more cost-effective.
- **Persist AI Analysis**: The results of the OpenAI analysis are currently only logged to the console. This valuable data should be saved. A good approach would be to add the analysis results to the corresponding property objects in the `results-sspc-*.json` files.
- **Generalize and Configure**: The script is hardcoded to analyze "House" properties for the term "Victorian". This should be made configurable to allow users to specify which property types to analyze and what features to look for without changing the code.
- **Incremental Processing**: The script should be ableto identify and process only new or updated properties since the last run. This would prevent re-analyzing the same properties, saving time and API costs. A "last_processed" timestamp or a status flag in the JSON files could facilitate this.
- **Advanced Prompt Engineering**: The prompt sent to the OpenAI API could be improved to provide more structured output. For example, instead of a simple "Yes/No" response, the prompt could request a JSON object with a boolean flag, a confidence score, and a brief justification.

## 4. Automation & Data Management

The automation is a great start, but the data management strategy could be improved for long-term scalability.

- **Integrate Summarization into Workflow**: The `summarise.ts` script should be added to the GitHub Actions workflow in `fetch.yml`. This would ensure that new properties are automatically analyzed as soon as they are scraped.
- **Data Storage Strategy**: Storing a large number of HTML files directly in the Git repository will make it bloated and slow over time. For better scalability, the data should be moved to a more suitable storage solution, such as a database (e.g., SQLite, PostgreSQL) or a cloud storage service (e.g., Amazon S3, Azure Blob Storage).

## 5. Documentation

Clear documentation is key to the project's usability and maintainability.

- **Update `README.md`**: The `README.md` should be updated to accurately reflect the current functionality (scraping `sspc.co.uk`, not `espc.com`). The "Old description" should be clarified or removed to avoid confusion.
- **Add Code Comments**: The codebase, particularly `app.ts` and `summarise.ts`, would benefit from more inline comments explaining complex logic, function purposes, and data structures.
- **This `ROADMAP.md`**: This file should be kept up to date as the project evolves.
