# Implementation Decisions

Current decisions for the SignalLens MVP. These guide implementation once it begins.

- **LightGBM** is the selected ML model.
- **Regex** is used only for candidate detection (the first detection layer), not for the final decision.
- The smart layer combines **context feature extraction**, **deterministic rules**, and the **LightGBM** model.
- The model receives **masked, structured features only**.
- Full secrets must **never** be logged, stored, or sent to the model.
- Validation can be **mocked** for the MVP.
- Mock data will be created separately (see [mock-data/](../mock-data/)).
