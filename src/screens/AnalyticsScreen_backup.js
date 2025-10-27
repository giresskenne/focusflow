import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { getAnalyticsHistory, getSettings } from '../storage';
import { computeSummary, computeMostBlockedApps, weekLabels, computeMonthBuckets, computeHourlyPatterns, computeTimeSpentOnApps, computeProductivityScore } from '../utils/analytics';
import { shareAnalytics, generateWeeklyDigest } from '../utils/exportAnalytics';
import { TrendingUpIcon, ClockIcon, TargetIcon, CalendarIcon, PieChartIcon, BarChart3Icon, ShareIcon, DownloadIcon } from '../components/Icons';

function StatCard({ label, value, sub }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function BarChart({ buckets, labels = weekLabels, height = 120 }) {
  const max = Math.max(1, ...buckets);
  return (
    <View style={{ paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: height + 20 }}>
        {buckets.map((v, i) => (
          <View key={i} style={{ width: Math.max(12, 300 / buckets.length), alignItems: 'center' }}>
            <View style={{ 
              width: Math.max(8, 280 / buckets.length), 
              height: Math.max(4, (v / max) * height), 
              backgroundColor: v > 0 ? '#2f6bff' : '#e5e7eb', 
              borderRadius: 6 
            }} />
            {labels[i] && <Text style={styles.axisLabel}>{labels[i]}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

function LineChart({ data, height = 100 }) {
  const max = Math.max(1, ...data);
  const width = Dimensions.get('window').width - 64; // padding
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * (width - 40),
    y: height - ((v / max) * height)
  }));

  return (
    <View style={{ height: height + 20, paddingVertical: 10 }}>
      <View style={{ position: 'relative', height, width: width - 40 }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(pct => (
          <View 
            key={pct}
            style={{ 
              position: 'absolute', 
              top: height * pct, 
              left: 0, 
              right: 0, 
              height: 1, 
              backgroundColor: '#f3f4f6' 
            }} 
          />
        ))}
        {/* Data line */}
        {points.map((point, i) => (
          <View key={i} style={{ 
            position: 'absolute', 
            left: point.x - 2, 
            top: point.y - 2, 
            width: 4, 
            height: 4, 
            backgroundColor: '#2f6bff', 
            borderRadius: 2 
          }} />
        ))}
      </View>
    </View>
  );
}

function ProductivityRing({ score, size = 80 }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;
  
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size - 12,
        height: size - 12,
        borderRadius: (size - 12) / 2,
        borderWidth: 6,
        borderColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        <View style={{
          position: 'absolute',
          width: size - 12,
          height: size - 12,
          borderRadius: (size - 12) / 2,
          borderWidth: 6,
          borderColor: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444',
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          transform: [{ rotate: `${(score / 100) * 360 - 90}deg` }]
        }} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#374151' }}>{score}</Text>
      </View>
    </View>
  );
}

function TabButton({ active, onPress, icon: Icon, label }) {
  return (
    <TouchableOpacity 
      style={[styles.tab, active && styles.tabActive]} 
      onPress={onPress}
    >
      <Icon size={16} color={active ? '#2f6bff' : '#6b7280'} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState({ totalSessions: 0, totalFocusSeconds: 0, bestStreakDays: 0, avgSessionSeconds: 0, changeVsLastWeekPercent: 0, productiveDayIndex: 0, weekBuckets: [0,0,0,0,0,0,0] });
  const [topApps, setTopApps] = useState([]);
  const [monthData, setMonthData] = useState([]);
  const [hourlyPatterns, setHourlyPatterns] = useState([]);
  const [timeSpentApps, setTimeSpentApps] = useState([]);
  const [productivityScore, setProductivityScore] = useState(0);
  const [settings, setSettings] = useState({});
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      const [analyticsHistory, userSettings] = await Promise.all([
        getAnalyticsHistory(),
        getSettings()
      ]);
      
      setHistory(analyticsHistory);
      setSummary(computeSummary(analyticsHistory));
      setTopApps(computeMostBlockedApps(analyticsHistory));
      setMonthData(computeMonthBuckets(analyticsHistory));
      setHourlyPatterns(computeHourlyPatterns(analyticsHistory));
      setTimeSpentApps(computeTimeSpentOnApps(analyticsHistory));
      setProductivityScore(computeProductivityScore(analyticsHistory, 60)); // 60 min target
      setSettings(userSettings || {});
    })();
  }, []);

  const totalH = Math.floor(summary.totalFocusSeconds / 3600);
  const avgM = Math.round(summary.avgSessionSeconds / 60);
  const changeText = `${summary.changeVsLastWeekPercent >= 0 ? '↑' : '↓'} ${Math.abs(summary.changeVsLastWeekPercent)}% vs last week`;
  const insightDay = weekLabels[summary.productiveDayIndex] || 'Mon';
  
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3Icon },
    { id: 'trends', label: 'Trends', icon: TrendingUpIcon },
    { id: 'apps', label: 'Apps', icon: PieChartIcon },
    { id: 'patterns', label: 'Patterns', icon: ClockIcon }
  ];

  const handleExport = async (format = 'report') => {
    try {
      const result = await shareAnalytics(history, format);
      if (result.success) {
        Alert.alert('Export Successful', `Analytics exported as ${result.filename}`);
      } else {
        Alert.alert('Export Failed', result.message);
      }
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export analytics data');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Analytics</Text>
            <Text style={[styles.screenSub, { color: '#9aa0b3' }]}>Your focus insights</Text>
          </View>
          <TouchableOpacity 
            style={styles.exportButton}
            onPress={() => handleExport('report')}
          >
            <ShareIcon size={18} color="#2f6bff" />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {tabs.map(tab => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onPress={() => setActiveTab(tab.id)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </View>

        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'trends' && renderTrendsTab()}
        {activeTab === 'apps' && renderAppsTab()}
        {activeTab === 'patterns' && renderPatternsTab()}
      </ScrollView>
    </View>
  );

  function renderOverviewTab() {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Analytics</Text>
          <Text style={[styles.screenSub, { color: '#9aa0b3' }]}>Your focus insights</Text>

          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            {tabs.map(tab => (
              <TabButton
                key={tab.id}
                active={activeTab === tab.id}
                onPress={() => setActiveTab(tab.id)}
                icon={tab.icon}
                label={tab.label}
              />
            ))}
          </View>

          {renderTabContent()}
        </ScrollView>
      </View>
    );

  function renderTabContent() {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'trends':
        return renderTrendsTab();
      case 'apps':
        return renderAppsTab();
      case 'patterns':
        return renderPatternsTab();
      default:
        return renderOverviewTab();
    }
  }

  function renderOverviewTab() {
    return (
      <>
        {/* Productivity Score */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Productivity Score</Text>
            <ProductivityRing score={productivityScore} size={60} />
          </View>
          <Text style={{ color: '#6b7280', marginTop: 8, fontSize: 14 }}>
            {productivityScore >= 80 ? 'Excellent! You\'re maintaining great focus habits.' :
             productivityScore >= 60 ? 'Good progress! Try to be more consistent.' :
             'Keep going! Small sessions add up to big results.'}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.grid4}>
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <StatCard label="TOTAL SESSIONS" value={String(summary.totalSessions)} />
          </View>
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <StatCard label="FOCUS TIME" value={`${totalH}h`} />
          </View>
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <StatCard label="BEST STREAK" value={`${summary.bestStreakDays}`} sub="days" />
          </View>
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <StatCard label="AVG SESSION" value={`${avgM}m`} />
          </View>
        </View>

        {/* This Week */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }] }>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>This Week</Text>
            <Text style={styles.badgeSuccess}>{changeText}</Text>
          </View>
          <BarChart buckets={summary.weekBuckets} />
        </View>

        {/* Quick Insight */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }] }>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Insight</Text>
          <Text style={{ color: '#6b7280', marginTop: 6 }}>
            You're most productive on {insightDay}! Your average session length increases on that day compared to others.
          </Text>
        </View>
      </>
    );
  }

  function renderTrendsTab() {
    return (
      <>
        {/* 30-Day Trend */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>30-Day Focus Trend</Text>
          <LineChart data={monthData} height={120} />
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
            Daily focus minutes over the last 30 days
          </Text>
        </View>

        {/* Weekly Comparison */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Progress</Text>
          <BarChart buckets={summary.weekBuckets} />
          <Text style={styles.badgeSuccess}>{changeText}</Text>
        </View>

        {/* Streak Analysis */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Streak Analysis</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <TargetIcon size={24} color="#10b981" />
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
                {summary.bestStreakDays} days
              </Text>
              <Text style={{ color: '#6b7280' }}>Best streak</Text>
            </View>
          </View>
          <Text style={{ color: '#6b7280', marginTop: 8, fontSize: 14 }}>
            Consistency is key! Try to maintain daily focus sessions to build momentum.
          </Text>
        </View>
      </>
    );
  }

  function renderAppsTab() {
    return (
      <>
        {/* Time Saved by App */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Time Saved by Blocking</Text>
          {timeSpentApps.slice(0, 5).map((app, idx) => (
            <View key={app.id} style={{ marginTop: 12 }}>
              <View style={styles.appRow}>
                <Text style={[styles.appLabel, { color: colors.text }]}>{app.label}</Text>
                <Text style={styles.appMeta}>
                  {app.timeFormatted.h}h {app.timeFormatted.m}m saved
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressBar, { 
                  width: `${Math.min(100, (app.timeSeconds / (timeSpentApps[0]?.timeSeconds || 1)) * 100)}%` 
                }]} />
              </View>
            </View>
          ))}
          {timeSpentApps.length === 0 && (
            <Text style={{ color: '#9aa0b3', marginTop: 6 }}>
              No data yet. Start blocking distracting apps to see time saved.
            </Text>
          )}
        </View>

        {/* Most Blocked Apps */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }] }>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Most Blocked Apps</Text>
          {topApps.map((app, idx) => (
            <View key={app.id} style={{ marginTop: 12 }}>
              <View style={styles.appRow}>
                <Text style={[styles.appLabel, { color: colors.text }]}>{app.label}</Text>
                <Text style={styles.appMeta}>{app.count} times</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressBar, { 
                  width: `${Math.min(100, (app.count / (topApps[0]?.count || 1)) * 100)}%` 
                }]} />
              </View>
            </View>
          ))}
          {topApps.length === 0 && (
            <Text style={{ color: '#9aa0b3', marginTop: 6 }}>
              No data yet. Start a focus session to see insights.
            </Text>
          )}
        </View>
      </>
    );
  }

  function renderPatternsTab() {
    const peakHour = hourlyPatterns.indexOf(Math.max(...hourlyPatterns));
    const peakTime = peakHour === 0 ? '12 AM' : 
                    peakHour < 12 ? `${peakHour} AM` : 
                    peakHour === 12 ? '12 PM' : 
                    `${peakHour - 12} PM`;

    return (
      <>
        {/* Peak Focus Time */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Peak Focus Time</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <ClockIcon size={24} color="#2f6bff" />
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
                {peakTime}
              </Text>
              <Text style={{ color: '#6b7280' }}>Most productive hour</Text>
            </View>
          </View>
          <Text style={{ color: '#6b7280', marginTop: 8, fontSize: 14 }}>
            Schedule important work during your peak focus hours for better results.
          </Text>
        </View>

        {/* Hourly Patterns */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Focus Pattern</Text>
          <BarChart 
            buckets={hourlyPatterns} 
            labels={hourlyPatterns.map((_, i) => i % 4 === 0 ? `${i}` : '')}
            height={100}
          />
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
            Focus minutes by hour of day (0-23)
          </Text>
        </View>

        {/* Focus Recommendations */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Personalized Tips</Text>
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 4 }}>
              • Best time to focus: {peakTime}
            </Text>
            <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 4 }}>
              • Most productive day: {insightDay}
            </Text>
            <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 4 }}>
              • Recommended session length: {avgM > 0 ? `${avgM} minutes` : '25 minutes'}
            </Text>
          </View>
        </View>

        {/* Export Options */}
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Export & Share</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <TouchableOpacity 
              style={styles.exportOptionButton}
              onPress={() => handleExport('report')}
            >
              <ShareIcon size={16} color="#2f6bff" />
              <Text style={{ color: '#2f6bff', fontWeight: '600' }}>Share Report</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.exportOptionButton}
              onPress={() => handleExport('csv')}
            >
              <DownloadIcon size={16} color="#2f6bff" />
              <Text style={{ color: '#2f6bff', fontWeight: '600' }}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }
};

const styles = StyleSheet.create({
  screenTitle: { fontSize: 28, fontWeight: '800' },
  screenSub: { marginBottom: 16 },
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#f8f9fa', 
    borderRadius: 12, 
    padding: 4, 
    marginBottom: 20 
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 8,
    gap: 6
  },
  tabActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  tabLabelActive: { color: '#2f6bff' },
  grid4: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flex: 1, minWidth: '48%', borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  statCard: { alignItems: 'flex-start' },
  statLabel: { fontSize: 12, color: '#8f93b3', fontWeight: '700' },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  statSub: { fontSize: 12, color: '#9aa0b3' },
  axisLabel: { fontSize: 10, color: '#9aa0b3', marginTop: 4 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeSuccess: { fontSize: 12, color: '#10b981', backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  appRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appLabel: { fontWeight: '600' },
  appMeta: { color: '#9aa0b3', fontSize: 13 },
  progressBg: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 999, marginTop: 6, overflow: 'hidden' },
  progressBar: { height: 6, backgroundColor: '#2f6bff' },
  exportButton: { 
    padding: 8, 
    borderRadius: 8, 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  exportOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2f6bff',
    backgroundColor: '#f8fafc',
    gap: 8
  },
});
