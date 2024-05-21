# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog], and this project adheres to
[Semantic Versioning] for all versions >=1.0.0.

## [0.0.6] - 2024-05-20

### Added

-   JSDocs for each method.

### Changed

-   `removeExpiredSessions` now returns a `Promise<void>`

## [0.0.3] - 2024-05-15

### Changed

-   Removed `sessions` & `table` properties from `PathConfig`

## [0.0.2] - 2024-05-15

### Added

-   `SessionPath` and `TablePath` interface for better data representation

### Changed

-   Moved `Adaptor` interface to `/internal` directory

[keep a changelog]: https://keepachangelog.com/en/1.0.0/
[semantic versioning]: https://semver.org/spec/v2.0.0.html
