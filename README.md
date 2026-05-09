# 📱 Smartphone Market Analysis & Interactive Dashboard

![Python](https://img.shields.io/badge/Python-3.14-blue.svg)
![Streamlit](https://img.shields.io/badge/Streamlit-Dashboard-FF4B4B.svg)
![Plotly](https://img.shields.io/badge/Plotly-Interactive-3F4F75.svg)

## 🎯 Overview
Proyek ini mengeksplorasi dinamika pasar smartphone global melalui analisis data yang mendalam. Fokus utamanya adalah memahami bagaimana brand, harga, dan spesifikasi teknis membentuk tren pasar saat ini. Dashboard ini dibangun untuk memberikan visualisasi yang jujur dan akurat bagi pengambil keputusan.

Sebagai mahasiswa **Data Science**, saya tidak hanya menyajikan angka, tetapi juga memastikan setiap insight berasal dari data yang telah divalidasi kebenarannya melalui proses pembersihan yang ketat.



## 🛠️ Data Science Logic (The "Core" Workout)
Analisis ini menangani tantangan data dunia nyata dengan teknik yang disiplin:

* **Data Cleaning:** Menggabungkan berbagai sumber dataset mentah menjadi satu sumber kebenaran (*single source of truth*).
* **Missing Value Handling:** Menggunakan **Median Imputation** untuk mengisi data yang bolong tanpa merusak distribusi asli data.
* **Outlier Management:** Menggunakan **Interquartile Range (IQR)** untuk mendeteksi dan menangani harga "Sultan" yang ekstrem agar tidak membiasakan rata-rata pasar, namun tetap mempertahankan konteks brand premium.
* **Visual Storytelling:** Menggunakan **Plotly** untuk membuat grafik yang tidak hanya cantik, tapi juga fungsional dan interaktif.

## 📂 Project Anatomy
Struktur folder yang rapi memudahkan skalabilitas dan audit kode:

```text
Smartphone_Analysis/
├── data/
│   ├── raw/           # Bahan baku (Dataset asli yang masih kotor)
│   └── processed/     # Hasil olahan (Dataset final siap analisis)
├── notebooks/         # Lab riset (.ipynb) untuk eksperimen EDA & Cleaning
├── app.py             # Mesin utama Dashboard Streamlit
├── requirements.txt   # Daftar suplemen (Library dependencies)
├── .gitignore         # Satpam (Memastikan file sampah tidak masuk ke GitHub)
└── README.md          # Panggung utama portofolio

🚀 Cara Menjalankan Dashboard
Bagi Anda yang ingin melihat hasil analisis secara lokal:

Clone Repository:

Bash
git clone [https://github.com/username/Smartphone_Analysis.git](https://github.com/username/Smartphone_Analysis.git)
cd Smartphone_Analysis
Setup Virtual Environment:

Bash
python -m venv .venv
# Aktifkan venv (Windows: .venv\Scripts\activate | Mac/Linux: source .venv/bin/activate)
Install Dependencies:

Bash
pip install -r requirements.txt
Run Application:

Bash
streamlit run app.py
📊 Insights & Discovery
Identifikasi korelasi kuat antara kapasitas RAM dan harga di segmen mid-range.

Visualisasi dominasi pasar brand tertentu yang memiliki variasi model paling luas.

Distribusi harga smartphone yang cenderung right-skewed, menunjukkan pasar yang didominasi oleh perangkat budget-friendly.

👤 Author
Benedictus Alfred Djaja

Data Science Student at Bina Nusantara University

Aspiring Developer Academy Learner

LinkedIn | GitHub
