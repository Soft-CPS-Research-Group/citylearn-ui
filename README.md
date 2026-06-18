# CityLearn UI

Client-side UI for inspecting CityLearn simulator output folders.

The app runs entirely in the browser. Users import one or more result folders, then inspect timeseries CSV files, KPI scorecards, KPI tables, and comparisons between simulations. There are no jobs, queues, accounts, or backend services.

## Expected Files

The importer recognizes folders that contain CSV outputs such as:

- `exported_kpis.csv`
- `kpis.csv`
- `exported_data_*.csv`

You can select a single simulation folder or a parent folder containing multiple simulation folders.

## Sample Data

For a quick local test, import the `sample-results/` folder in this repo. It contains:

- `rbc-basic-market-real-1999h/`
- `rbc-community-market-real-1999h/`
- `rbc-smart-market-real-1999h/`

Each sample simulation is copied directly from a real `Algorithms` simulator export. The folders
include hourly timeseries for 17 buildings, batteries, chargers, EVs, community and pricing,
plus KPI v2 outputs with BAU enabled. Regenerate them with:

```bash
python3 scripts/generate_sample_results.py
```

## Development

Use Node 22 or newer. With `nvm`:

```bash
nvm use
```

```bash
npm install
npm start
```

The app will be available at `http://localhost:3000`.

## Production Build

```bash
npm run build
```

The generated `dist/` folder can be deployed to any static host.

## Docker

```bash
docker compose up --build
```

The container serves the production build through Nginx on `http://localhost:3000`.
