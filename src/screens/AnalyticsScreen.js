import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { getAnalyticsHistory } from '../storage';
import { computeSummary, computeMostBlockedApps, weekLabels } from '../utils/analytics';

function StatCard({ label, value, sub }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function BarChart({ buckets }) {
  const max = Math.max(1, ...buckets);
  return (
    <View style={{ paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140 }}>
        {buckets.map((v, i) => (
          <View key={i} style={{ width: 20, alignItems: 'center' }}>
            <View style={{ width: 20, height: Math.max(6, (v / max) * 120), backgroundColor: '#2f6bff', borderRadius: 8 }} />
            <Text style={styles.axisLabel}>{weekLabels[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const [summary, setSummary] = useState({ totalSessions: 0, totalFocusSeconds: 0, bestStreakDays: 0, avgSessionSeconds: 0, changeVsLastWeekPercent: 0, productiveDayIndex: 0, weekBuckets: [0,0,0,0,0,0,0] });
  const [topApps, setTopApps] = useState([]);

  useEffect(() => {
    (async () => {
      const history = await getAnalyticsHistory();
      setSummary(computeSummary(history));
      setTopApps(computeMostBlockedApps(history));
    })();
  }, []);

  const totalH = Math.floor(summary.totalFocusSeconds / 3600);
  const avgM = Math.round(summary.avgSessionSeconds / 60);
  const changeText = `${summary.changeVsLastWeekPercent >= 0 ? '↑' : '↓'} ${Math.abs(summary.changeVsLastWeekPercent)}% vs last week`;
  const insightDay = weekLabels[summary.productiveDayIndex] || 'Mon';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>Analytics</Text>
      <Text style={[styles.screenSub, { color: '#9aa0b3' }]}>Your focus insights</Text>

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

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }] }>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>This Week</Text>
          <Text style={styles.badgeSuccess}>{changeText}</Text>
        </View>
        <BarChart buckets={summary.weekBuckets} />
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }] }>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Most Blocked Apps</Text>
        {topApps.map((app, idx) => (
          <View key={app.id} style={{ marginTop: 12 }}>
            <View style={styles.appRow}>
              <Text style={[styles.appLabel, { color: colors.text }]}>{app.label}</Text>
              <Text style={styles.appMeta}>{app.count} times</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressBar, { width: `${Math.min(100, (app.count / (topApps[0]?.count || 1)) * 100)}%` }]} />
            </View>
          </View>
        ))}
        {topApps.length === 0 && (
          <Text style={{ color: '#9aa0b3', marginTop: 6 }}>No data yet. Start a focus session to see insights.</Text>
        )}
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }] }>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Insight</Text>
        <Text style={{ color: '#6b7280', marginTop: 6 }}>You're most productive on {insightDay}! Your average session length increases on that day compared to others.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 28, fontWeight: '800' },
  screenSub: { marginBottom: 12 },
  grid4: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flex: 1, minWidth: '48%', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  statCard: { alignItems: 'flex-start' },
  statLabel: { fontSize: 12, color: '#8f93b3', fontWeight: '700' },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  statSub: { fontSize: 12, color: '#9aa0b3' },
  axisLabel: { fontSize: 12, color: '#9aa0b3', marginTop: 6 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeSuccess: { fontSize: 12, color: '#10b981', backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  appRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appLabel: { fontWeight: '600' },
  appMeta: { color: '#9aa0b3' },
  progressBg: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 999, marginTop: 6, overflow: 'hidden' },
  progressBar: { height: 6, backgroundColor: '#2f6bff' },
});
