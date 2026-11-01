# CityLearn UI

Client-side UI for inspecting CityLearn simulator output folders.

The app runs entirely in the browser. Users import one or more result folders, then inspect timeseries files, KPI scorecards, KPI tables, and comparisons between simulations. There are no jobs, queues, accounts, or backend services.

## Expected Files

The importer recognizes wide CSV or Parquet outputs such as:

- `exported_kpis.csv`
- `kpis.csv`
- `exported_data_*.csv` or `.parquet`
- Native long `kpis.csv` with `level`, `name`, `cost_function`, `value`
- Native Parquet parts such as `exported_data_*_ep0_part00000.parquet`

You can select a single simulation folder or a parent folder containing multiple simulation folders.

Equipment views recognise the columns exported by both CityLearn and CPS Simulator;
building IDs do not need to follow `Building_*` or `Member_*`. Original IDs and values
are retained. Equipment is associated with a building using an explicit identity when
available, or an unambiguous filename prefix. Unrecognised equipment and ambiguous
associations remain accessible under **Other**.

Charts sum interval energy, average power, prices and SOC, and use the last available
value for recognised stock/state fields in the generic view. Additional numeric columns
remain selectable in the legend; the first four are initially visible. No manifest is
required to read existing CSV exports.

The cost scorecard distinguishes absolute cost (lower is preferable), savings
(higher is preferable), and dimensionless cost ratios. A saving is reference cost
minus control cost; its percentage uses the magnitude of the reference cost. A
zero reference has no percentage. BAU and legacy-baseline values are paired
separately. With partial or different references, comparisons use the common
exported absolute costs when available. Mixed measures remain visible without an
automatic best/delta. A bare legacy `cost` column retains its reported value without
assuming a currency or reference.

KPI cards show the metric name and final value with its unit. The service criterion
remains part of the metric name. Target attainment and minimum acceptable service
stay distinct; zero departures are not presented as a failed 0% rate. Fractional
rates are formatted as percentages, while grouped KPI tables retain the exported
numeric values. Comparison calculations still check denominators, coverage and
pairing context before assigning an automatic winner.

Parquet decoding runs locally using [hyparquet](https://github.com/hyparam/hyparquet)
and its [compression codecs](https://github.com/hyparam/hyparquet-compressors); no files
are uploaded. Numbered native parts are joined in order. If CSV and Parquet copies
coexist, CSV is used for charts and alternative data remains available as a table,
without counting equipment or energy twice. Unrecognised tables remain inspectable.
Long KPI rows feed the adapted scorecard and the grouped numeric drill-down.

Optional sibling `*.manifest.json`, `*.deferrable_service.json` and `*.robustness.json`
files add export context: version, resolution, executed duration, BAU definition,
final inventory and available service/robustness coverage. Standalone `manifest.json`,
`service.json` and `robustness.json` are also supported. Missing or malformed optional
metadata does not prevent inspecting valid data. Metadata is used internally for
clocks and comparison checks; the main results view does not display context or
data-quality inspectors. Series source tables include pagination.

Comparisons distinguish matching declared experiment contexts, known differences and
unknown context. Automatic best/improvement styling requires both metric compatibility
and a complete matching pairing contract. Without a manifest, numerical differences
and neutral reported extrema remain visible. With known context differences, values
remain available without an automatic winner. Matching metadata describes supplied
evidence; it is not independent verification of an experiment. Final inventory and
service outcomes may differ between controllers; their initial conditions and service
definitions must match. Original entity IDs remain distinct, including names that
would collide after punctuation or case normalisation.

### File and multi-community identities

Equipment selection uses the complete source-file identity, including path, size and
modification time; short 32-bit hashes are not used as unique identities. Folder
fingerprints are deterministic across file-picker ordering. Web Crypto keeps folder
IDs compact where available; a full tuple identity keeps imports working otherwise.

Native consolidated multi-community long KPIs use `community_id`, `level` and `name`
as the scope identity. Identical local names in different communities stay separate;
legitimate scopes at different levels also stay separate. Scope labels retain the
community/name/level and source tables retain the original columns and rows. Portfolio
values are read from the export, not inferred by summing local rows or averaging rates.
Duplicate records within the same qualified scope remain diagnosed and excluded.
Declared scopes with unavailable values remain selectable as unknown. Old wide and
long files without `community_id` retain their existing scope interpretation.

### Time and reconstructed community data

ISO timestamps with offsets identify absolute instants. Charts and date filters show
these in **UTC**, including distinct instants when a local clock repeats at DST.
A naive timestamp uses a declared timezone when it identifies a unique instant;
without a timezone, it keeps the exported wall clock and is labelled accordingly.
Ambiguous, invalid or incompatible clocks retain all source rows on an explicit row
axis. The short clock label identifies UTC, local time, elapsed time, step or row. The browser's timezone never supplies a missing export timezone.

Numeric `time_step`, `episode_time_step`, `step` and `index` fields are episode
indices; `global_step` and `global_time_step` are global indices. Optional native
metadata supplies the dataset `start_date`, `seconds_per_time_step`, timezone and
`episode_start_time_step`. A declared `temporal_reproducibility.index_origin` of
`global` overrides the numeric index convention. A manifest identifying one episode
is not applied to a different episode. Real timestamps take precedence over inferred
calendars. Without an origin, indices with known duration use relative time; without
a duration, they stay unscaled indices. `hour` and `month` observations are not clocks.
Unlabelled row positions do not prove when a member entered a community.

Date filters use the displayed UTC or exported local clock. Relative axes use numeric
index controls. Display buckets remain anchored across gaps and sum interval energy;
no empty interval is filled with fabricated demand. Sub-minute resolution is retained.
Charts with incompatible clocks or declared durations have separate controls.

Exported community totals remain authoritative. If totals are absent, reconstruction
joins member observations by instant/global step, preserving sparse rows and original
energy signs. An optional native member catalogue and topology schedule distinguish
absence from missing active-member data; without membership evidence, values are
labelled as known subtotals. Missing channels stay unknown, and an unsupported channel
is not invented as zero. Repeated member coordinates are ambiguous contributions and
are excluded from the reconstructed subtotal; original member source rows remain
available. Declared inactive rows conflicting with observations are flagged and their
reported values retained. Partial coverage is retained internally after chart aggregation.
The membership schedule describes supplied evidence, not an independently verified
record that every planned event succeeded.

Incompatible clocks or different declared interval durations do not produce a guessed
community total. Individual equipment views and source tables remain available. This
work does not perform resampling or allocate coarse interval energy to finer samples.

### Data quality and partial imports

Import validation retains issue locations, original samples and calculation impact
internally. The UI omits diagnostic panels and per-chart coverage explanations;
individual series source tables remain available.

CSV records with a wrong field count or malformed quoting are retained but excluded
from calculations. Extra fields remain visible. Empty/duplicate headers preserve
values under explicit column labels; ambiguous
headers are not used to guess a chart or scorecard. Empty tables do not generate zero
measurements. A failed file or folder does not erase other valid imports; an unreadable
result does not remove other imports. Optional invalid metadata does not prevent
reading valid data.

Distinct KPI identities survive other invalid/duplicate records. All occurrences of
an ambiguous identity are excluded, rather than averaged or selected arbitrarily;
original rows remain accessible. Long entity names, including numeric-looking IDs,
are identities rather than numeric measurements. Invalid numeric KPI values remain
visible as source values and qualify the comparison context.

Chart calculations distinguish complete values among supplied samples, partial data
and unknown signals. Missing, non-finite and filtered inputs are counted separately from genuine
zero. Sums of incomplete data are known subtotals; means use available values. With
a declared cadence, coverage counts grid positions in the selected span; otherwise
interval population remains unknown. Unrepresented positions are not filled with
zeros or automatically diagnosed as a member leaving. Invalid clock records can be
isolated while valid calendar records retain their true instants; unresolved clocks
still support source-row inspection. Excluded source records also qualify a
reconstructed community, including exclusions at its recorded boundaries.

Derived battery/charger channels retain their sign and disconnected-state conventions.
A charger with both energy inputs unavailable has unknown energy, rather than a
fabricated measured zero; one available input gives a qualified subtotal. Per-signal
input availability is retained without changing simulator physics or exported values.
File quality describes imported evidence and is not independent physical calibration
or proof that all experiment records were exported. Large-scale import performance
remains a separate validation stage.

## Large folders and charts

Imports read folders one at a time in a local module worker. Progress identifies the
current folder/file and counts started files and completed folders. A completed folder
can be inspected while the remaining folders read. **Cancel import** stops pending
work and keeps completed/previous imports; an unfinished folder is not presented as a
complete simulation. If workers are unavailable, existing formats remain readable
through sequential foreground reading, yielding between files.

Imported data is held in memory for the current page. Removing a simulation releases
its data; source files are never changed or uploaded. There is no fixed member/file
size limit. Capacity depends on available device memory, row/column counts and export
layout. Background reading keeps parsing separate from the screen, but transferring
large results and calculating views still require memory and processing time.

Above 800 selected interval aggregates, equipment charts reduce drawing to actual
points, retaining endpoints and per-signal minima/maxima in each sampling group,
with representative missing-value positions. Zoom into a shorter period to inspect
exact timing. This selection does not change source rows, KPI values or interval
aggregation. Energy totals use all selected intervals, never just the drawn subset.
Coarse SOC/power aggregation follows the selected mean/state rule. Connection
overlays can simplify drawing while retaining all source events.

Source tables retain all records and support a direct page number and **Last rows**,
so long periods do not require stepping through hundreds of pages.

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

Use the Node version pinned in `.nvmrc` (also used by CI, Docker and Netlify). With `nvm`:

```bash
nvm use
```

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm start
```

The app will be available at `http://localhost:3000`.

## Checks and source layout

```bash
npm test                 # unit and result-model tests
npm run lint            # JavaScript, hooks and architecture
npm run format:check    # source/configuration formatting
npm run build
npx playwright install chromium
npm run test:browser    # production-build browser compatibility tests
npm run check           # all checks above, including a fresh build
```

Browser tests use small CPS/CityLearn CSV and Parquet excerpts and temporary folders;
they do not execute simulations or regenerate sample results. Scale tests generate
temporary two-year and many-member fixtures, check overview extrema/full-span totals,
worker fallback, cancellation, comparison selection, table navigation and memory
release across repeated import/removal. These fixtures are volume/contract tests,
not additional measured simulator campaigns. Failure screenshots and
traces go to ignored `test-results/`. `UI_CHROME_EXECUTABLE` can select an installed
Chrome executable; `UI_BUILD_DIR` and `UI_TEST_OUTPUT_DIR` can move build/test artifacts
outside the checkout. Browser tests need an available local port 3177.

- `src/App.jsx`: imported simulation state and screen composition.
- `src/results/`: format adapters, identity, clocks, coverage, aggregation, costs,
  EV service, KPI definitions, scorecards and comparison models; no presentation imports.
- `src/features/`: timeseries, KPI and comparison views, with chart selection helpers.
- `src/components/`: shared navigation, footer, source tables and comparison context.
- `src/utils/`: shared collection helpers.

Architecture checks reject missing relative imports, dependency cycles, unreachable
source modules and presentation dependencies in result models. The GitHub checks
workflow runs one verification job; it has read-only repository access and no deployment
or issue-closing step.

Development tools are pinned in `package-lock.json`. The `minimatch` override selects
11.0.3 to avoid the vulnerable 10.2.6 dependency still requested by ESLint's tree.
The installed consumers use `Minimatch` and `.match()`, which remain available in 11;
they do not use the removed regular-expression API. Validate with a clean install and
lint when changing this override. No runtime UI dependency requires this override.

## Test coverage

Tests cover genuine, small CityLearn/CPS export excerpts, custom IDs, ambiguous
associations, and energy conservation across chart granularities. Fixture provenance
is recorded in the fixture directories. Format tests compare equivalent wide CSV,
long CSV and Parquet data, native parts, compression codecs, optional metadata,
partial imports and pairing-context mismatches.

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
