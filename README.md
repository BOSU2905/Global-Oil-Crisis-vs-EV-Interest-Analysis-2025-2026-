# 🛢️ Oil vs. ⚡ EV: The Global Energy Transition Analysis

![Python](https://img.shields.io/badge/Python-3.14-blue.svg)
![Data-Analysis](https://img.shields.io/badge/Analytic-Time--Series-green.svg)
![Energy-Trends](https://img.shields.io/badge/Sector-Energy-orange.svg)

## 🎯 Overview
Proyek ini menganalisis pergeseran paradigma konsumsi energi global, membandingkan dominasi bahan bakar fosil (Oil) dengan pertumbuhan eksponensial Kendaraan Listrik (EV). Fokus utama adalah melihat kapan titik temu (*intersection point*) di mana efisiensi EV mulai secara signifikan mendisrupsi permintaan minyak mentah dunia.

Sebagai **Data Science Learner**, saya mengeksplorasi dataset ini untuk memahami apakah narasi "End of Oil" didukung oleh data yang valid atau sekadar sentimen pasar.

## 🛠️ Data Engineering & Logic
Menganalisis dua sektor yang berbeda membutuhkan ketelitian ekstra pada "metabolisme" datanya:

* **Unit Standardization:** Mengonversi berbagai metrik energi (misal: barrels of oil equivalent vs. Gigawatt-hours) ke dalam satu standar perbandingan yang adil.
* **Time-Series Analysis:** Menggunakan teknik *smoothing* untuk melihat tren jangka panjang tanpa terganggu oleh fluktuasi harga minyak harian.
* **Correlation Study:** Menganalisis apakah penurunan harga baterai EV berkorelasi langsung dengan adopsi kendaraan listrik di negara-negara berkembang.
* **Forecasting:** Mencoba memproyeksikan tren adopsi menggunakan model regresi sederhana untuk melihat estimasi dominasi pasar di masa depan.

## 📂 Project Structure
Organisasi folder yang disiplin untuk memastikan audit data yang transparan:

```text
Oil_EV_Trends/
├── data/
│   ├── raw/           # Dataset mentah dari IEA/EIA/OPEC
│   └── processed/     # Data yang sudah diseragamkan unitnya
├── notebooks/         # Analisis korelasi dan forecasting (.ipynb)
├── scripts/           # Helper scripts untuk konversi unit
├── .venv/             # Isolated environment (Python 3.14)
├── requirements.txt   # Dependensi (Pandas, Scipy, Matplotlib)
├── .gitignore         # Guardrail untuk file cache dan sistem
└── README.md          # Dokumentasi utama proyek
🚀 Installation & Usage
Proyek ini menggunakan Python 3.14 untuk performa komputasi yang lebih optimal.

Clone & Enter:

Bash
git clone [https://github.com/username/Oil_EV_Trends.git](https://github.com/username/Oil_EV_Trends.git)
cd Oil_EV_Trends
Environment Setup:

Bash
python -m venv .venv
# Aktifkan venv sesuai OS Anda
Install Dependencies:

Bash
pip install -r requirements.txt
📊 Key Insights Captured
Visualisasi laju pertumbuhan tahunan (CAGR) dari adopsi EV yang melampaui prediksi awal dekade.

Analisis "Energy Density": Mengapa sektor logistik berat masih sulit lepas dari ketergantungan minyak dibandingkan kendaraan penumpang.

Peta adopsi EV global yang menunjukkan kesenjangan antara infrastruktur pengisian daya dan minat beli konsumen.

✍️ Author
Benedictus Alfred Djaja

Data Science Undergraduate | Bina Nusantara University

Aspiring Apple Developer Academy Member

LinkedIn | GitHub
