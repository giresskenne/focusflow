import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAnalyticsHistory, getSettings } from '../storage';
import { computeSummary, computeMostBlockedApps, weekLabels, computeMonthBuckets, computeHourlyPatterns, computeTimeSpentOnApps, computeProductivityScore } from '../utils/analytics';
import { shareAnalytics } from '../utils/exportAnalytics';
import { TrendingUpIcon, ClockIcon, TargetIcon, PieChartIcon, BarChart3Icon, ShareIcon, DownloadIcon } from '../components/Icons';
import { SkeletonCard } from '../components/SkeletonLoader';
import LoadingScreen from '../components/LoadingScreen';
import GradientBackground from '../components/GradientBackground';
import GlassCard from '../components/Ui/GlassCard';
import { colors } from '../theme';

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
  const width = Dimensions.get('window').width - 64;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * (width - 40),
    y: height - ((v / max) * height)
  }));

  return (
    <View style={{ height: height + 20, paddingVertical: 10 }}>
      <View style={{ position: 'relative', height, width: width - 40 }}>
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
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
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
      setProductivityScore(computeProductivityScore(analyticsHistory, 60));
      setIsLoading(false);
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

  if (isLoading) {
    return <LoadingScreen message="Loading analytics..." />;
  }

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
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

          {renderTabContent()}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
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
        <GlassCard tint="dark" intensity={60} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Productivity Score</Text>
            <ProductivityRing score={productivityScore} size={60} />
          </View>
          <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 14 }}>
            {productivityScore >= 80 ? 'Excellent! You\'re maintaining great focus habits.' :
             productivityScore >= 60 ? 'Good progress! Try to be more consistent.' :
             'Keep going! Small sessions add up to big results.'}
          </Text>
        </GlassCard>

        <View style={styles.grid4}>
          <GlassCard tint="dark" intensity={60} style={styles.card}>
            <StatCard label="TOTAL SESSIONS" value={String(summary.totalSessions)} />
          </GlassCard>
          <GlassCard tint="dark" intensity={60} style={styles.card}>
            <StatCard label="FOCUS TIME" value={`${totalH}h`} />
          </GlassCard>
          <GlassCard tint="dark" intensity={60} style={styles.card}>
            <StatCard label="BEST STREAK" value={`${summary.bestStreakDays}`} sub="days" />
          </GlassCard>
          <GlassCard tint="dark" intensity={60} style={styles.card}>
            <StatCard label="AVG SESSION" value={`${avgM}m`} />
          </GlassCard>
        </View>

        <GlassCard tint="dark" intensity={60} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>This Week</Text>
            <Text style={styles.badgeSuccess}>{changeText}</Text>
          </View>
          <BarChart buckets={summary.weekBuckets} />
        </GlassCard>

        <GlassCard tint="dark" intensity={60} style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Insight</Text>
          <Text style={{ color: colors.mutedForeground, marginTop: 6 }}>
            You're most productive on {insightDay}! Your average session length increases on that day compared to others.
          </Text>
        </GlassCard>
      </>
    );
  }

  function renderTrendsTab() {
    return (
      <>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>30-Day Focus Trend</Text>
          <LineChart data={monthData} height={120} />
          <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
            Daily focus minutes over the last 30 days
          </Text>
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Progress</Text>
          <BarChart buckets={summary.weekBuckets} />
          <Text style={styles.badgeSuccess}>{changeText}</Text>
        </View>

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
        </View>
      </>
    );
  }

  function renderAppsTab() {
    return (
      <>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Time Saved by Blocking</Text>
          {timeSpentApps.slice(0, 5).map((app) => (
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
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }] }>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Most Blocked Apps</Text>
          {topApps.map((app) => (
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
        </View>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Focus Pattern</Text>
          <BarChart 
            buckets={hourlyPatterns} 
            labels={hourlyPatterns.map((_, i) => i % 4 === 0 ? `${i}` : '')}
            height={100}
          />
        </View>

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
}

const styles = StyleSheet.create({
  screenTitle: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: colors.foreground 
  },
  screenSub: { 
    marginBottom: 16, 
    color: colors.mutedForeground 
  },
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
    borderRadius: 12, 
    padding: 4, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
  tabActive: { 
    backgroundColor: colors.primary, 
    shadowColor: colors.primary, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 4, 
    elevation: 4 
  },
  tabLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: colors.mutedForeground 
  },
  tabLabelActive: { 
    color: colors.foreground 
  },
  grid4: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12 
  },
  card: { 
    flex: 1, 
    minWidth: '48%', 
    borderRadius: 16, 
    marginBottom: 12 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '800',
    color: colors.foreground 
  },
  statCard: { 
    alignItems: 'flex-start' 
  },
  statLabel: { 
    fontSize: 12, 
    color: colors.mutedForeground, 
    fontWeight: '700' 
  },
  statValue: { 
    fontSize: 22, 
    fontWeight: '800', 
    marginTop: 4,
    color: colors.foreground 
  },
  statSub: { 
    fontSize: 12, 
    color: colors.mutedForeground 
  },
  axisLabel: { 
    fontSize: 10, 
    color: colors.mutedForeground, 
    marginTop: 4 
  },
  cardHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  badgeSuccess: { 
    fontSize: 12, 
    color: colors.success, 
    backgroundColor: colors.activeGreenBg, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 999 
  },
  appRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  appLabel: { 
    fontWeight: '600',
    color: colors.foreground 
  },
  appMeta: { 
    color: colors.mutedForeground, 
    fontSize: 13 
  },
  progressBg: { 
    height: 6, 
    backgroundColor: colors.border, 
    borderRadius: 999, 
    marginTop: 6, 
    overflow: 'hidden' 
  },
  progressBar: { 
    height: 6, 
    backgroundColor: colors.primary 
  },
  exportButton: { 
    padding: 8, 
    borderRadius: 8, 
    backgroundColor: colors.glassBackground, 
    borderWidth: 1, 
    borderColor: colors.glassBorder 
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
    borderColor: colors.primary,
    backgroundColor: colors.glassBackground,
    gap: 8
  },
});