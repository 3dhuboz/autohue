# Car Photo Color Sorter

An AI-powered web application that automatically sorts car photographs by color. Perfect for photographers who need to organize their car inventory for sales purposes.

## Features

- **Bulk Upload**: Upload multiple car photos at once
- **AI Car Detection**: Uses YOLOv8 to automatically detect cars in images
- **Color Classification**: Identifies the dominant color of each vehicle
- **Automatic Sorting**: Organizes photos into color-coded folders
- **ZIP Export**: Download all sorted photos as a single ZIP file
- **Real-time Progress**: Live processing status and progress tracking

## Color Categories

The app sorts photos into these simplified color categories:
- Red (including maroon, burgundy, crimson)
- Blue (including navy, royal, sky)
- Green (including emerald, forest, lime)
- Yellow (including gold, amber, mustard)
- Orange (including tangerine, coral)
- Purple (including violet, indigo, magenta)
- Pink (including rose, fuchsia)
- Brown (including tan, beige, khaki)
- Black/Gray (including charcoal, slate)
- White (including cream, ivory, pearl)
- Metallic (including chrome, steel, aluminum)

## Technology Stack

- **Backend**: Flask (Python)
- **AI Models**: 
  - YOLOv8 for car detection
  - K-means clustering for color extraction
- **Image Processing**: OpenCV, PIL
- **Frontend**: HTML5, Tailwind CSS, JavaScript
- **Machine Learning**: PyTorch, scikit-learn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd car-photo-color-sorter
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python app.py
```

5. Open your browser and navigate to `http://localhost:5000`

## Usage

1. **Upload Photos**: Drag and drop car photos or click to browse files
2. **Start Processing**: Click "Start Processing" to begin AI analysis
3. **Monitor Progress**: Watch real-time processing status
4. **Download Results**: Download the sorted photos as a ZIP file

## How It Works

1. **Car Detection**: Uses YOLOv8 to locate vehicles in each image
2. **Color Extraction**: Applies K-means clustering to identify dominant colors
3. **Color Classification**: Maps RGB values to simplified color categories
4. **File Organization**: Copies images to appropriate color folders
5. **Export**: Packages all sorted photos into a downloadable ZIP

## File Structure

```
car-photo-color-sorter/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Frontend interface
├── uploads/              # Temporary upload storage
├── output/               # Processed image folders
├── processed/            # ZIP files for download
└── README.md            # This file
```

## Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- BMP (.bmp)

## Performance Notes

- Processing time depends on image size and quantity
- Typical processing: 2-5 seconds per image
- Maximum file size: 100MB per upload session
- Recommended batch size: 50-100 images per session

## Troubleshooting

**Common Issues:**

1. **"No car detected"**: Ensure the car is clearly visible and not too small in the frame
2. **Processing errors**: Check that images are valid and not corrupted
3. **Memory issues**: Reduce batch size or image resolution for large batches

**Tips for Best Results:**
- Use high-quality, well-lit photos
- Ensure cars are the main subject
- Avoid heavily filtered or edited images
- Keep backgrounds relatively simple

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please create an issue in the repository or contact the development team.
