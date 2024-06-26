# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning for all versions >=1.0.0.

## [0.0.3] - 2024-05-20

### Changed

-   Indicated private methods with a '\_'
-   `getUserSessions` now uses allSettled
-   Optimized `removeExpiredSessions` to use less network requests

## [0.0.2] - 2024-05-18

### Removed

-   `firebase-admin` as a peer-dependency

### Added

-   `@firebase/database-types` as a peer-dependency

## [0.0.1] - 2024-05-15

### Added

-   `AdminAdaptor` implementation

[keep a changelog]: https://keepachangelog.com/en/1.0.0/
[semantic versioning]: https://semver.org/spec/v2.0.0.html
