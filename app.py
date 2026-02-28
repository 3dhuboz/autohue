from flask import Flask, request, jsonify, send_file, render_template
from werkzeug.utils import secure_filename
import os
import cv2
import numpy as np
from PIL import Image
import zipfile
import shutil
from ultralytics import YOLO
import torch
from sklearn.cluster import KMeans
import json
from datetime import datetime
import threading

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'output'
app.config['PROCESSED_FOLDER'] = 'processed'

# Create necessary directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

# Color mapping for simplified color categories
COLOR_MAPPING = {
    'red': ['red', 'maroon', 'burgundy', 'crimson', 'scarlet'],
    'blue': ['blue', 'navy', 'royal', 'sky', 'cyan'],
    'green': ['green', 'emerald', 'forest', 'lime', 'olive'],
    'yellow': ['yellow', 'gold', 'amber', 'mustard'],
    'orange': ['orange', 'tangerine', 'coral'],
    'purple': ['purple', 'violet', 'indigo', 'magenta'],
    'pink': ['pink', 'rose', 'fuchsia'],
    'brown': ['brown', 'tan', 'beige', 'khaki', 'taupe'],
    'black': ['black', 'charcoal', 'gray', 'grey', 'slate'],
    'white': ['white', 'cream', 'ivory', 'pearl', 'silver'],
    'metallic': ['metallic', 'chrome', 'steel', 'aluminum']
}

class CarColorSorter:
    def __init__(self):
        self.yolo_model = YOLO('yolov8n.pt')  # Pre-trained YOLO model
        self.processed_count = 0
        self.total_images = 0
        self.current_status = "Ready"
        
    def detect_car(self, image_path):
        """Detect if there's a car in the image and return the bounding box"""
        try:
            results = self.yolo_model(image_path)
            # Look for car class (usually class 2 or 7 in COCO dataset)
            car_detections = []
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    if box.cls == 2 or box.cls == 7:  # Car classes in COCO
                        car_detections.append(box.xyxy[0].cpu().numpy())
            
            if car_detections:
                # Return the largest car detection
                largest_box = max(car_detections, key=lambda box: (box[2]-box[0]) * (box[3]-box[1]))
                return largest_box
            return None
        except Exception as e:
            print(f"Error detecting car: {e}")
            return None
    
    def extract_car_region(self, image_path, bbox):
        """Extract the car region from the image"""
        try:
            img = cv2.imread(image_path)
            if img is None:
                return None
            
            x1, y1, x2, y2 = map(int, bbox)
            # Add some padding around the car
            padding = 20
            x1 = max(0, x1 - padding)
            y1 = max(0, y1 - padding)
            x2 = min(img.shape[1], x2 + padding)
            y2 = min(img.shape[0], y2 + padding)
            
            car_region = img[y1:y2, x1:x2]
            return car_region
        except Exception as e:
            print(f"Error extracting car region: {e}")
            return None
    
    def get_dominant_color(self, car_region):
        """Extract dominant color from car region using K-means clustering"""
        try:
            # Convert to RGB and reshape for clustering
            car_rgb = cv2.cvtColor(car_region, cv2.COLOR_BGR2RGB)
            pixels = car_rgb.reshape(-1, 3)
            
            # Use K-means to find dominant colors
            kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
            kmeans.fit(pixels)
            
            # Get the most dominant color (largest cluster)
            labels = kmeans.labels_
            label_counts = np.bincount(labels)
            dominant_color = kmeans.cluster_centers_[np.argmax(label_counts)]
            
            return dominant_color.astype(int)
        except Exception as e:
            print(f"Error extracting dominant color: {e}")
            return None
    
    def color_to_category(self, rgb_color):
        """Convert RGB color to simplified color category"""
        if rgb_color is None:
            return 'unknown'
        
        r, g, b = rgb_color
        
        # Simple color classification based on RGB values
        if r < 50 and g < 50 and b < 50:
            return 'black'
        elif r > 200 and g > 200 and b > 200:
            return 'white'
        elif r > 150 and g < 100 and b < 100:
            return 'red'
        elif r < 100 and g < 100 and b > 150:
            return 'blue'
        elif r < 100 and g > 150 and b < 100:
            return 'green'
        elif r > 200 and g > 200 and b < 100:
            return 'yellow'
        elif r > 200 and g > 150 and b < 100:
            return 'orange'
        elif r > 150 and g < 100 and b > 150:
            return 'purple'
        elif r > 200 and g < 150 and b > 150:
            return 'pink'
        elif (r > 100 and g > 50 and b < 50) or (r > 50 and g > 30 and b < 30):
            return 'brown'
        elif abs(r - g) < 30 and abs(g - b) < 30 and abs(r - b) < 30:
            return 'black'  # Gray colors
        else:
            return 'metallic'
    
    def process_image(self, image_path, output_folder):
        """Process a single image: detect car, identify color, and copy to appropriate folder"""
        try:
            # Detect car
            bbox = self.detect_car(image_path)
            if bbox is None:
                return None, "No car detected"
            
            # Extract car region
            car_region = self.extract_car_region(image_path, bbox)
            if car_region is None:
                return None, "Failed to extract car region"
            
            # Get dominant color
            dominant_color = self.get_dominant_color(car_region)
            if dominant_color is None:
                return None, "Failed to extract color"
            
            # Convert to color category
            color_category = self.color_to_category(dominant_color)
            
            # Create color folder if it doesn't exist
            color_folder = os.path.join(output_folder, color_category)
            os.makedirs(color_folder, exist_ok=True)
            
            # Copy image to color folder
            filename = os.path.basename(image_path)
            output_path = os.path.join(color_folder, filename)
            shutil.copy2(image_path, output_path)
            
            return color_category, "Success"
            
        except Exception as e:
            return None, f"Error processing image: {str(e)}"
    
    def process_bulk_images(self, image_paths, output_folder):
        """Process multiple images and return results"""
        results = []
        self.total_images = len(image_paths)
        self.processed_count = 0
        
        for image_path in image_paths:
            self.current_status = f"Processing {os.path.basename(image_path)}..."
            color_category, status = self.process_image(image_path, output_folder)
            
            results.append({
                'filename': os.path.basename(image_path),
                'color': color_category,
                'status': status
            })
            
            self.processed_count += 1
        
        self.current_status = "Processing complete"
        return results

# Initialize the sorter
sorter = CarColorSorter()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_files():
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('files')
        if not files or files[0].filename == '':
            return jsonify({'error': 'No files selected'}), 400
        
        # Create unique session folder
        session_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        session_upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
        session_output_folder = os.path.join(app.config['OUTPUT_FOLDER'], session_id)
        
        os.makedirs(session_upload_folder, exist_ok=True)
        os.makedirs(session_output_folder, exist_ok=True)
        
        # Save uploaded files
        image_paths = []
        for file in files:
            if file and file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                filename = secure_filename(file.filename)
                file_path = os.path.join(session_upload_folder, filename)
                file.save(file_path)
                image_paths.append(file_path)
        
        if not image_paths:
            return jsonify({'error': 'No valid image files found'}), 400
        
        # Process images in background thread
        def process_images():
            results = sorter.process_bulk_images(image_paths, session_output_folder)
            # Save results to JSON file
            results_path = os.path.join(session_output_folder, 'results.json')
            with open(results_path, 'w') as f:
                json.dump(results, f, indent=2)
        
        thread = threading.Thread(target=process_images)
        thread.start()
        
        return jsonify({
            'session_id': session_id,
            'message': 'Processing started',
            'total_images': len(image_paths)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/status/<session_id>')
def get_status(session_id):
    try:
        session_output_folder = os.path.join(app.config['OUTPUT_FOLDER'], session_id)
        results_path = os.path.join(session_output_folder, 'results.json')
        
        if os.path.exists(results_path):
            with open(results_path, 'r') as f:
                results = json.load(f)
            
            return jsonify({
                'status': 'completed',
                'processed': sorter.processed_count,
                'total': sorter.total_images,
                'results': results
            })
        else:
            return jsonify({
                'status': 'processing',
                'processed': sorter.processed_count,
                'total': sorter.total_images,
                'current_file': sorter.current_status
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download/<session_id>')
def download_results(session_id):
    try:
        session_output_folder = os.path.join(app.config['OUTPUT_FOLDER'], session_id)
        zip_path = os.path.join(app.config['PROCESSED_FOLDER'], f'car_photos_{session_id}.zip')
        
        # Create ZIP file
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(session_output_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, session_output_folder)
                    zipf.write(file_path, arcname)
        
        return send_file(zip_path, as_attachment=True, download_name=f'car_photos_{session_id}.zip')
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
