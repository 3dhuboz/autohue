@echo off
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting Car Photo Color Sorter...
echo.
echo The application will be available at: http://localhost:5000
echo Press Ctrl+C to stop the server
echo.
python app.py
