import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

st.title("Oil Crisis vs EV Trends")
st.header("Datasets")
df = pd.read_csv("data/final_data.csv")
st.write(df)

st.set_page_config(layout='wide')
st.header("Correlation Analysis WorldWide")

col1, col2 = st.columns(2)
with col1:
    df_chart = df.set_index('Observation Date')
    st.line_chart(df_chart['Price($)/Litre'], x_label='Date (September 2025 -> March 2026)', y_label='Raw Oil Price ($)',)
    st.info("""
    **Insight:** Between March 15–22, 2026, as oil prices surged to $0.70, 
    EV interest hit a maximum score of 100. This suggests that fuel price 
    shocks are a major catalyst for EV adoption interest.
""")
with col2:
    # fig, (ax1) = plt.subplots(1, figsize=(10,5))
    # sns.set_theme("talk")
    # sns.regplot(data=df, x='Price($)/Litre', y='Worldwide Trends', ax= ax1, line_kws={'color':'red'}, scatter_kws={'alpha':1})
    # ax1.set_title("Korelasi Secara Dunia")
    # ax1.set_ylabel("EV Worldwide Trends")
    # ax1.set_xlabel("Raw Oil Price $/Litre")
    # st.pyplot(fig)
    st.scatter_chart(data=df, x='Price($)/Litre', y='Worldwide Trends', color='#E87F24')
    st.info("""
    **Insight:** Oil Spike vs. EV Hype: Data confirms a near-perfect correlation between the March 2026 energy crisis and EV interest. Once oil hit $0.65/litre, public awareness hit the ceiling (100/100). This 'Panic Search' phenomenon proves that fuel price shocks are the single greatest driver for electric vehicle curiosity worldwide.
""")

st.write("When the Pump Hits, the World Looks for a Plug. Between March 15 and 22, 2026, we witnessed more than just a price hike—we saw a shift in consumer consciousness. As oil prices climbed toward $0.70/L, the search volume for EVs hit a perfect 100/100 score. This 'panic-search' phenomenon proves that fuel crisis anxiety is a primary driver for the electric revolution, as consumers desperately look for an escape from volatile gas prices.")

insights = {
    "Indonesia EV Trends" : """
***Insight:*** : Despite the Indonesian government’s successful efforts to maintain fuel price stability—shielding citizens from both subsidized and non-subsidized price hikes—the public's digital footprint reveals deep-seated anxiety.
Our data mining shows a massive 'mountain peak' in EV interest on February 15, 2026. This wasn't driven by a rise in local gas prices, but by something far more volatile: The Escalation of the Iran-Israel-USA Conflict.
""",
"USA EV Trends": """
***Insight:*** : For Americans, the energy crisis was no longer a distant headline; it became a domestic reality. As the geopolitical friction reached its boiling point, the volatility of the global energy market finally hit home.
The data shows a vertical climb to a Perfect Score of 100 on Google Trends. This wasn't just curiosity; it was a mass-scale search for an exit strategy. The American public—traditionally fond of powerful combustion engines—suddenly shifted their focus toward Electric Vehicles as the ultimate shield against energy insecurity.
""",
"Malaysia EV Trends":"""
***Insight: Mirroring the Indonesian 'Mountain Peak,' Malaysia’s EV interest skyrocketed in mid-February 2026. However, the driver here was far more direct: Government Policy. As the Middle Eastern conflict tightened global energy supplies, the Malaysian government was forced to slash fuel subsidies, reducing the monthly quota from 300 litres to 200 litres per consumer.***
""",
"Norway EV Trends":"""
***Insight***: While the world panics, Norway remains calm. The lack of a major correlation between oil prices and EV search trends proves that Norway has reached a 'Post-Transition' phase. At this stage, EV ownership is no longer a reaction to a crisis—it is the standard of living.
""",
"Singapore EV Trends":"""
***Insight:***: With no fuel subsidies to cushion the blow, Singapore became a fascinating case study in market volatility during the March 2026 energy crisis. As conflict flared in the Middle East, Google Trends saw a massive breakout, peaking on March 8th. This wasn't just noise; it was a digital migration. With pump prices skyrocketing to a staggering SGD 3.40 – 4.16 per liter, the data reveals a clear 'gold mine' for analysts: a direct, real-time correlation between geopolitical shockwaves and a massive surge in EV interest.
"""
}
country_choices = st.selectbox(
    'Choose What Country to Analyze:', 
    list(insights.keys())
)
st.write(f"Visualizing Data for **{country_choices}**")
st.line_chart(df_chart[country_choices], y_label="Google Trends Score", x_label="Date Observation")

st.divider()
st.subheader(f"Key Insights for {country_choices.split(' ')[0]}")
st.info(insights[country_choices])

st.subheader("Data analysis base by the oil prices ")

oil_vs_ev_insights = {
    "Indonesia EV Trends":"""
***Insights:***
""","USA EV Trends":"""
***Insights:***
""","Malaysia EV Trends":"""
***Insights:***
""","Norway EV Trends":"""
***Insights:***
""","Singapore EV Trends":"""
***Insights:***
""",

}

choice = st.selectbox(
    'Choose Country',['Indonesia EV Trends','Malaysia EV Trends','Norway EV Trends', 'Singapore EV Trends', 'USA EV Trends']
)

st.scatter_chart(data=df,x='Price($)/Litre', y=choice, color='#D1855C')


