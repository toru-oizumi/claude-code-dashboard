import streamlit as st
from snowflake.snowpark.context import get_active_session

st.set_page_config(
    page_title="Claude Code Activity Dashboard",
    page_icon="🤖",
    layout="wide",
)

session = get_active_session()

st.title("🤖 Claude Code Activity Dashboard")

# サイドバー: フィルター
with st.sidebar:
    st.header("フィルター")
    date_range = st.date_input(
        "期間",
        value=[],
        help="集計対象の期間を選択",
    )
    users = session.sql("SELECT DISTINCT user_email FROM CLAUDE_CODE.EVENTS_RAW ORDER BY 1").collect()
    user_options = ["全員"] + [row["USER_EMAIL"] for row in users]
    selected_user = st.selectbox("ユーザー", user_options)

# --- Section 1: ユーザー別ランキング ---
st.header("👥 ユーザー別ランキング")

col1, col2 = st.columns(2)

with col1:
    st.subheader("会話量ランキング（過去30日）")
    df_sessions = session.sql("""
        SELECT
            user_email,
            SUM(sessions)       AS total_sessions,
            SUM(total_events)   AS total_events,
            ROUND(SUM(cost_usd), 3) AS cost_usd
        FROM CLAUDE_CODE.USER_DAILY
        WHERE dt >= DATEADD('day', -30, CURRENT_DATE())
        GROUP BY user_email
        ORDER BY total_sessions DESC
        LIMIT 20
    """).to_pandas()
    st.dataframe(df_sessions, use_container_width=True, hide_index=True)

with col2:
    st.subheader("スキル活用率ランキング（過去30日）")
    df_quality = session.sql("""
        SELECT
            user_email,
            SUM(total_events)   AS total_events,
            SUM(skill_count)    AS skill_count,
            SUM(sub_agent_count)AS sub_agent_count,
            SUM(mcp_count)      AS mcp_count,
            ROUND(
                (SUM(skill_count) + SUM(sub_agent_count) + SUM(mcp_count))
                / NULLIF(SUM(total_events), 0) * 100, 1
            ) AS advanced_usage_pct
        FROM CLAUDE_CODE.USER_DAILY
        WHERE dt >= DATEADD('day', -30, CURRENT_DATE())
        GROUP BY user_email
        ORDER BY advanced_usage_pct DESC NULLS LAST
        LIMIT 20
    """).to_pandas()
    st.dataframe(df_quality, use_container_width=True, hide_index=True)

# --- Section 2: ツール横断利用状況 ---
st.header("🛠️ ツール横断利用ランキング（過去30日）")

col3, col4, col5 = st.columns(3)

for col, event_type, label in [
    (col3, "skill", "スキルランキング"),
    (col4, "sub_agent", "サブエージェントランキング"),
    (col5, "mcp", "MCPランキング"),
]:
    with col:
        st.subheader(label)
        df = session.sql(f"""
            SELECT
                event_name,
                SUM(unique_users) AS unique_users,
                SUM(usage_count)  AS usage_count
            FROM CLAUDE_CODE.TOOL_DAILY
            WHERE dt >= DATEADD('day', -30, CURRENT_DATE())
              AND event_type = '{event_type}'
            GROUP BY event_name
            ORDER BY usage_count DESC
            LIMIT 15
        """).to_pandas()
        st.dataframe(df, use_container_width=True, hide_index=True)

# --- Section 3: コスト推移 ---
st.header("💰 コスト推移（日次）")

df_cost = session.sql("""
    SELECT
        dt,
        SUM(cost_usd) AS daily_cost_usd
    FROM CLAUDE_CODE.USER_DAILY
    WHERE dt >= DATEADD('day', -30, CURRENT_DATE())
    GROUP BY dt
    ORDER BY dt
""").to_pandas()
df_cost = df_cost.set_index("DT")
st.line_chart(df_cost["DAILY_COST_USD"], use_container_width=True)

# --- Section 4: ワークスペース別 ---
st.header("📁 ワークスペース別活用（過去30日）")

df_ws = session.sql("""
    SELECT
        workspace,
        SUM(unique_users) AS unique_users,
        SUM(sessions)     AS sessions,
        SUM(total_events) AS total_events
    FROM CLAUDE_CODE.WORKSPACE_DAILY
    WHERE dt >= DATEADD('day', -30, CURRENT_DATE())
    GROUP BY workspace
    ORDER BY total_events DESC
    LIMIT 20
""").to_pandas()
st.dataframe(df_ws, use_container_width=True, hide_index=True)
