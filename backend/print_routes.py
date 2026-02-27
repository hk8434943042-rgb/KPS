import importlib.util
import sys
spec = importlib.util.spec_from_file_location("mod", "01_app.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(mod.app.url_map)
