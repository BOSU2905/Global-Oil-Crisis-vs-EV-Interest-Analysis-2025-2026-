import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

st.title("Global Oil Crisis vs EV Interest Analysis (2026)", text_alignment="center")
st.subheader("Developed an interactive dashboard to analyze the correlation between Brent Oil price volatility and global EV adoption interest across 5 countries.", text_alignment="center")
st.header("About the Data:")
df = pd.read_csv("data/final_data.csv")
st.write(df)
st.write("The Global Synchronicity Dataset: Synthesized from Official FRED (St. Louis Fed) oil prices and Google Trends interest scores. Our findings highlight a unique anomaly: a synchronized peak in EV interest across 5 different countries in a single month. This data-driven discovery validates the hypothesis that geopolitical energy shocks create a unified global shift in consumer awareness, regardless of borders.")

st.set_page_config(layout='wide')
st.header("Correlation Analysis WorldWide")

col1, col2 = st.columns(2)
with col1:
    df_chart = df.set_index('Observation Date')
    st.line_chart(df_chart['Price($)/Litre'], x_label='Date (September 2025 -> March 2026)', y_label='Raw Oil Price ($)',)
#     st.info("""
#     **Insight:** Between March 15–22, 2026, as oil prices surged to $0.70, 
#     EV interest hit a maximum score of 100. This suggests that fuel price 
#     shocks are a major catalyst for EV adoption interest.
# """)
with col2:
    # fig, (ax1) = plt.subplots(1, figsize=(10,5))
    # sns.set_theme("talk")
    # sns.regplot(data=df, x='Price($)/Litre', y='Worldwide Trends', ax= ax1, line_kws={'color':'red'}, scatter_kws={'alpha':1})
    # ax1.set_title("Korelasi Secara Dunia")
    # ax1.set_ylabel("EV Worldwide Trends")
    # ax1.set_xlabel("Raw Oil Price $/Litre")
    # st.pyplot(fig)
    st.scatter_chart(data=df, x='Price($)/Litre', y='Worldwide Trends', color="#DB4D4D")
#     st.info("""
#     **Insight:** Oil Spike vs. EV Hype: Data confirms a near-perfect correlation between the March 2026 energy crisis and EV interest. Once oil hit $0.65/litre, public awareness hit the ceiling (100/100). This 'Panic Search' phenomenon proves that fuel price shocks are the single greatest driver for electric vehicle curiosity worldwide.
# """)
st.info("Between March 15 - 22, 2026, as oil prices surged to 0.70/litre, EV interests hit a maximum score of 100. This suggests that fuel price shocks are a major catalyst for EV adoption interest. And the data confirms a near perfect correlation between the March 2026 energy crisis and EV Interest. Once oil hit $0.65/litre, public awareness hit the ceiling 100. This 'Panic Search' Phenomenon proves that fuel price shocks are the single greatest driver for electric vehicle curiosity worldwide.")

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
***Insight*** : Mirroring the Indonesian 'Mountain Peak,' Malaysia’s EV interest skyrocketed in mid-February 2026. However, the driver here was far more direct: Government Policy. As the Middle Eastern conflict tightened global energy supplies, the Malaysian government was forced to slash fuel subsidies, reducing the monthly quota from 300 litres to 200 litres per consumer.
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
***Insights:***  The scatter plot for Indonesia reveals a significant cluster between 0.40 and 0.45 (approx. Rp7.200 raw price). In this zone, EV interest remains consistently low (Score 0-40), suggesting a high degree of public confidence in domestic fuel stability.

Even as global oil prices surged to $0.70, the majority of data points remained anchored below a score of 20. This indicates that as long as the government maintains the 'Subsidized Shield,' the Indonesian public views Electric Vehicles more as a FOMO-driven trend rather than an immediate economic necessity. The few outliers at the 100-mark represent 'Short-lived Panic' triggered by geopolitical headlines, which quickly stabilized once local pump prices remained unchanged.
""",
"USA EV Trends":"""
***Insights:*** s the world’s second-largest EV market in 2025, the U.S. data reveals a striking 'Wait-and-See' pattern. We see a heavy cluster between $0.38 and $0.45, where interest remained steady. However, as global tensions escalated, the market hit a Perfect 100 Score exactly at the $0.65 price point.

Domestic Resilience: Unlike other nations, the U.S. consumer response is backed by a massive domestic supply chain. With homegrown giants like Tesla and Rivian, the surge in EV interest is not just a flight from high oil prices, but a shift toward national energy independence.

Policy-Driven Volatility: The data reflects a unique irony: while U.S. geopolitical strategies (under the Trump administration’s energy policies) contributed to the global supply crunch, the American public responded by accelerating their exit from fossil fuels. For Americans, the $0.65 mark was the 'Breaking Point' where energy policy reality finally met the consumer's wallet, turning EV adoption into a strategic necessity."
""",
"Malaysia EV Trends":"""
***Insights:*** Unlike other regional markets, Malaysia exhibits an exceptional sensitivity to global energy shifts. Our scatter plot reveals that even at the moderate raw price range of 0.40 - $0.45, the search interest for EVs consistently accelerates toward a perfect score of 100.

This upward trajectory serves as more than just a trend; it is a Strategic Foresight. As of April 2026, this data confirms that the Malaysian public is proactively bracing for the projected June 2026 fuel crisis. By the time the crisis hits, the Malaysian market will likely have already transitioned its interest toward electric mobility, making them the most 'future-ready' nation in the region.
""",
"Norway EV Trends":"""
***Insights:*** As the global leader in electric mobility, Norway’s scatter plot shows a progressive climb from 33 to 100. This represents the 'Laggard Transition'—the final segment of the population that is now forced to switch due to the 2026 energy crisis. For these remaining ICE (Internal Combustion Engine) users, the crisis acts as the ultimate push to align with the dominant Norwegian lifestyle.

Resilience in Maturity: A fascinating observation is the decline in trend scores even as oil prices peaked. This is a sign of Market Saturation. Unlike other nations that experience panic, Norway remains resilient because the majority of its citizens have already decoupled their lives from oil. The remaining search activity likely shifts from 'discovery' to 'replacement'—users looking to upgrade their existing EV models rather than reacting to fuel shocks. In Norway, the energy crisis isn't a threat; it's a reminder of a problem they have already solved.
""",
"Singapore EV Trends":"""
***Insights:*** The Vulnerability Paradox. Singapore’s data reveals a high-sensitivity cluster between $0.40 and $0.45, with search scores ranging from 33 to 74. As a nation with zero natural energy resources and total import dependency, Singaporeans are exceptionally reactive to Middle Eastern geopolitical shocks.

However, an intriguing pattern emerges: while search interest spiked sharply at the $0.55 price point, it experienced a subsequent decline. This perfectly reflects the adoption barrier in the Singaporean market. Despite the high urge to switch due to energy costs, actual EV ownership remains at approximately 7% due to high infrastructure costs and the premium price of the Certificate of Entitlement (COE). The data proves that while the 'Intent' to go electric is high, the 'Readiness' to execute that transition is still hindered by economic realities.
""",

}

choice = st.selectbox(
    'Choose Country',['Indonesia EV Trends','Malaysia EV Trends','Norway EV Trends', 'Singapore EV Trends', 'USA EV Trends']
)
st.write(f"Visualizing Data for **{choice}**")
st.scatter_chart(data=df,x='Price($)/Litre', y=choice, color="#B0440A")
st.subheader(f"Key Insights for {choice.split(' ')[0]}")
st.info(oil_vs_ev_insights[choice])





