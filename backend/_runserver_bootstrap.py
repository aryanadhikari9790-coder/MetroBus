import os
import runpy
import site
import sys

site.addsitedir(r"C:\Users\adhik\MetroBus\backend\.venv\Lib\site-packages")
sys.path.insert(0, r"C:\Users\adhik\MetroBus\backend")
os.chdir(r"C:\Users\adhik\MetroBus\backend")
sys.argv = ['manage.py', 'runserver', '127.0.0.1:8000', '--noreload']
runpy.run_path('manage.py', run_name='__main__')
