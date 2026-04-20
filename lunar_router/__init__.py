"""Backwards-compatibility shim for the `lunar_router` package.

The project was renamed from `lunar_router` to `opentracy`. Installing the new
`opentracy` distribution also installs this shim so that any code importing
`lunar_router.*` keeps working. Emits `DeprecationWarning` on first import and
transparently redirects submodule imports to the corresponding `opentracy.*`
module via a PEP 451 `MetaPathFinder`.
"""

from __future__ import annotations

import importlib
import sys
import warnings
from importlib.abc import Loader, MetaPathFinder
from importlib.util import spec_from_loader
from types import ModuleType

warnings.warn(
    "`lunar_router` is deprecated and will be removed in a future release; "
    "use `opentracy` instead (same API, just rename the import).",
    DeprecationWarning,
    stacklevel=2,
)

_PREFIX = "lunar_router"
_TARGET_PREFIX = "opentracy"


class _RedirectLoader(Loader):
    """Resolves `lunar_router.X.Y` by importing `opentracy.X.Y` under that name."""

    def create_module(self, spec):  # noqa: D401
        target_name = _TARGET_PREFIX + spec.name[len(_PREFIX):]
        target = importlib.import_module(target_name)
        sys.modules[spec.name] = target
        return target

    def exec_module(self, module: ModuleType) -> None:  # noqa: D401
        # The module body has already been executed by the real import above.
        return None


class _RedirectFinder(MetaPathFinder):
    def find_spec(self, fullname: str, path=None, target=None):
        if fullname == _PREFIX or fullname.startswith(_PREFIX + "."):
            return spec_from_loader(fullname, _RedirectLoader())
        return None


sys.meta_path.insert(0, _RedirectFinder())

# Re-export the top-level `opentracy` attributes so `from lunar_router import X`
# works without going through the finder. Uses the same lazy __getattr__ pattern
# that opentracy.__init__ exposes, so we don't eagerly import heavy subpackages.
_real = importlib.import_module(_TARGET_PREFIX)


def __getattr__(name: str):
    # Legacy constant alias: `LUNAR_DATA_HOME` was renamed to `OPENTRACY_DATA_HOME`.
    if name == "LUNAR_DATA_HOME":
        from opentracy.hub import OPENTRACY_DATA_HOME as _v
        return _v
    try:
        return getattr(_real, name)
    except AttributeError:
        raise AttributeError(f"module 'lunar_router' has no attribute {name!r}") from None


def __dir__():
    extras = ["LUNAR_DATA_HOME"]
    return sorted(set(dir(_real)) | set(extras))


__version__ = getattr(_real, "__version__", "0.0.0")
