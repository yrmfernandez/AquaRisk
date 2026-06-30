Groundwater Quality Risk Assessment System

An end-to-end machine learning and full-stack web application for assessing groundwater quality for irrigation suitability, drinking water safety, and anomaly detection. The system combines supervised learning, unsupervised learning, and explainable AI to support informed groundwater quality assessment.

Status: Under Development

---

# Project Overview

Groundwater is one of the world's most important freshwater resources for agriculture and domestic use. Evaluating groundwater quality typically requires expert interpretation of multiple chemical parameters, making the process time-consuming and difficult for non-specialists.

This project aims to develop an intelligent decision support system that automatically analyzes groundwater chemical characteristics and provides predictions for different real-world applications.

The system consists of three machine learning modules:

- Irrigation Suitability Classification

  - Predict groundwater irrigation classes (e.g., C2S1, C3S1) from chemical parameters.

- Drinking Water Safety Assessment

  - Predict whether groundwater is suitable for drinking based on engineered labels derived from WHO/BIS standards.

- Groundwater Anomaly Detection

  - Detect chemically unusual groundwater samples using unsupervised learning for early warning and quality control.

To improve transparency, the application also explains model predictions using SHAP (SHapley Additive exPlanations).

---

# Features

- Multi-class irrigation suitability prediction
- Binary drinking water safety prediction
- Isolation Forest anomaly detection
- Interactive web application
- Explainable AI (SHAP)
- Prediction confidence scores
- Data visualization dashboard
- Prediction history
- REST API backend
- Responsive user interface

---

# Machine Learning Pipeline

```text
Groundwater Dataset
        │
        ▼
Data Cleaning & Preprocessing
        │
        ▼
Feature Engineering
        │
        ├───────────────┐
        ▼               ▼
Irrigation Model    Drinking Model
        │               │
        └──────┬────────┘
               ▼
      Anomaly Detection
               │
               ▼
        SHAP Explainability
               │
               ▼
          Flask REST API
               │
               ▼
        React Web Application
```

---

# Technology Stack

## Machine Learning

- Python
- Scikit-learn
- XGBoost
- Isolation Forest
- SHAP
- Joblib

## Data Analysis

- Pandas
- NumPy
- Matplotlib
- Seaborn

## Backend

- Flask
- Flask-CORS

## Frontend

- React
- Vite
- JavaScript
- HTML
- CSS

## Development Tools

- Git
- GitHub
- Jupyter Notebook
- VS Code

---

# Project Structure

```text
groundwater-quality-risk-assessment-system/
│
├── backend/
├── frontend/
├── data/
├── notebooks/
├── models/
├── docs/
├── scripts/
├── tests/
│
├── README.md
├── requirements.txt
├── LICENSE
└── .gitignore
```

---

# Dataset

The project uses a groundwater quality dataset containing physicochemical parameters collected from groundwater samples.

Example parameters include:

* pH
* Electrical Conductivity (EC)
* Total Dissolved Solids (TDS)
* Calcium
* Magnesium
* Sodium
* Potassium
* Chloride
* Sulfate
* Nitrate
* Fluoride
* Bicarbonate
* Carbonate
* Total Hardness
* Sodium Adsorption Ratio (SAR)
* Residual Sodium Carbonate (RSC)

---

# Getting Started

## Clone the Repository

```bash
git clone https://github.com/yrmfernandez/groundwater-quality-risk-assessment-system.git
```

## Navigate to the Project

```bash
cd groundwater-quality-risk-assessment-system
```

## Install Dependencies

```bash
pip install -r requirements.txt
```

## Start the Backend

```bash
cd backend
python app.py
```

## Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

---

# Development Roadmap

* [x] Initialize GitHub repository
* [x] Create project structure
* [ ] Perform exploratory data analysis
* [ ] Data preprocessing
* [ ] Irrigation suitability model
* [ ] Drinking water safety model
* [ ] Anomaly detection model
* [ ] SHAP explainability
* [ ] Flask REST API
* [ ] React frontend
* [ ] Database integration
* [ ] Testing
* [ ] Deployment

---

# Screenshots

Screenshots will be added as development progresses.

---

# Future Improvements

- User authentication
- Interactive GIS map visualization
- Batch CSV prediction
- PDF report generation
- Real-time water quality monitoring
- Mobile-responsive dashboard
- Cloud deployment
- Docker support

---

# License

This project is licensed under the MIT License.

---

# Author

Yman Rey M. Fernandez

Computer Science Major in Data Science

This project is being developed as a personal portfolio project to demonstrate practical skills in machine learning, data science, and full-stack web development.
