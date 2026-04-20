"""
OpenTracy Hub - Artifact Download Manager.

Download and manage pre-trained weights like NLTK, spaCy, and HuggingFace.

Usage:
    # CLI
    $ opentracy download weights-mmlu-v1
    $ opentracy list
    $ opentracy info weights-mmlu-v1

    # Python API
    >>> import opentracy
    >>> opentracy.download("weights-mmlu-v1")
    >>>
    >>> # Or auto-download on first use
    >>> router = opentracy.load_router()  # Downloads if missing
    >>>
    >>> # List available packages
    >>> opentracy.hub.list_packages()
    >>>
    >>> # Get info about a package
    >>> opentracy.hub.info("weights-mmlu-v1")
"""

from .manager import (
    download,
    list_packages,
    info,
    remove,
    path,
    verify,
    Hub,
    OPENTRACY_DATA_HOME,
    Package,
    PackageIndex,
)

__all__ = [
    # Main functions
    "download",
    "list_packages",
    "info",
    "remove",
    "path",
    "verify",
    # Classes
    "Hub",
    "Package",
    "PackageIndex",
    # Constants
    "OPENTRACY_DATA_HOME",
]
