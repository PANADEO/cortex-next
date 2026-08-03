# Ported 1:1 from ~/REPO/cortex-document-parser/src/core/exceptions.py — the
# pipeline logic that raises these is being ported too (src/pipeline.py),
# no reason to rename or restructure a working, already-minimal hierarchy.
class AppError(Exception):
    """Base class for domain errors raised by the document processing flow."""


class DependencyError(AppError):
    pass


class ConversionError(AppError):
    pass


class AIProcessingError(AppError):
    pass
