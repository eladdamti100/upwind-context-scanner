# Mock Data

This folder will contain the mock customer files and the manifest used for the SignalLens demo. The actual mock data is created separately — only the expected structure exists here for now (see [manifest.placeholder.json](manifest.placeholder.json)).

The mock data should include a representative mix of finding kinds:

- **true secrets**
- **false positives**
- **placeholders** (e.g. `YOUR_API_KEY`)
- **documentation examples**
- **test values**
- **borderline findings** (require review)

Each entry should carry metadata such as:

- **file path**
- **file type**
- **exposure** (e.g. storage exposure / asset criticality)
- **customer vertical**
- **expected label**

Actual mock files go under [files/](files/).
