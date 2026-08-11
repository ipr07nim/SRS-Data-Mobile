import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Block,
  BlockTitle,
  Icon,
  List,
  ListItem,
  Segmented,
  SegmentedButton,
} from 'konsta/react';
import { StarFill } from 'framework7-icons/react';
import { MdEmojiEvents } from 'react-icons/md';
import { BUGGY_OPTIONS, HILL_AVERAGES, HILL_LABELS } from '../config/app.config';
import type { HillLabel } from '../config/app.config';
import { formatPusherDriver, type LeaderboardHill } from '../domain/rolls';
import { leaderboardCacheKey } from '../services/supabase/leaderboard';
import { useAppStore } from '../store';
import { HorizontalScrollRow } from './shared/HorizontalScrollRow';
import { LoadingIndicator } from './shared/LoadingIndicator';

const HILL_VIEWS: LeaderboardHill[] = ['all', ...HILL_LABELS];

export default function Leaderboard() {
  const navigate = useNavigate();
  const loadLeaderboard = useAppStore((s) => s.loadLeaderboard);
  const leaderboardByKey = useAppStore((s) => s.leaderboardByKey);
  const leaderboardLoadStatus = useAppStore((s) => s.leaderboardLoadStatus);
  const leaderboardComputedAt = useAppStore((s) => s.leaderboardComputedAt);
  const [activeHill, setActiveHill] = useState<LeaderboardHill>('all');
  const [buggyFilter, setBuggyFilter] = useState<string>('all');

  useEffect(() => {
    void loadLeaderboard(activeHill, buggyFilter);
  }, [activeHill, buggyFilter, loadLeaderboard]);

  const cacheKey = leaderboardCacheKey(activeHill, buggyFilter);
  const entries = useMemo(
    () => leaderboardByKey[cacheKey] ?? [],
    [leaderboardByKey, cacheKey],
  );

  const isFullRollView = activeHill === 'all';
  const showBuggyOnCard = buggyFilter === 'all';
  const isLoading = leaderboardLoadStatus === 'loading' && entries.length === 0;

  const middleLabel = (driver: string, pusher: string) => {
    const d = driver.trim() || 'Unknown';
    if (isFullRollView) return d;
    return formatPusherDriver(pusher, driver);
  };

  return (
    <div className="py-4 px-4 flex flex-col gap-4">
      <HorizontalScrollRow className="pb-1">
        <Segmented strong rounded>
          {HILL_VIEWS.map((hill) => (
            <SegmentedButton
              key={hill}
              active={activeHill === hill}
              onClick={() => setActiveHill(hill)}
            >
              {hill === 'all' ? 'All' : hill}
            </SegmentedButton>
          ))}
        </Segmented>
      </HorizontalScrollRow>

      <HorizontalScrollRow>
        <Segmented strong rounded>
          <SegmentedButton active={buggyFilter === 'all'} onClick={() => setBuggyFilter('all')}>
            All
          </SegmentedButton>
          {BUGGY_OPTIONS.map((buggy) => (
            <SegmentedButton
              key={buggy}
              active={buggyFilter === buggy}
              onClick={() => setBuggyFilter(buggy)}
            >
              {buggy}
            </SegmentedButton>
          ))}
        </Segmented>
      </HorizontalScrollRow>

      {leaderboardComputedAt && (
        <p className="text-[10px] text-center text-[var(--app-fg-muted)]">
          Rankings updated daily — last refresh{' '}
          {new Date(leaderboardComputedAt).toLocaleString()}
        </p>
      )}

      {isLoading && <LoadingIndicator label="Loading leaderboard…" />}

      <List strongIos outlineIos insetMaterial>
        {!isLoading && entries.length === 0 && (
          <ListItem
            title="No leaderboard data yet"
            subtitle="Run refresh_leaderboard_cache() in Supabase after exporting completed rolls."
          />
        )}
        {entries.map((entry) => (
          <ListItem
            key={`${entry.rollId}-${entry.rank}`}
            link
            title={middleLabel(entry.driver, entry.name)}
            subtitle={`${entry.date} · ${entry.timeDisplay}${
              showBuggyOnCard ? ` · ${entry.buggy}` : ''
            }`}
            after={<span className="font-mono font-bold text-primary">{entry.time}</span>}
            media={
              entry.rank === 1 ? (
                <Icon
                  ios={<StarFill className="w-6 h-6 text-primary" />}
                  material={<MdEmojiEvents className="w-6 h-6 text-primary" />}
                />
              ) : (
                <span className="text-sm font-bold text-[var(--app-fg-muted)] w-6 text-center">
                  #{entry.rank}
                </span>
              )
            }
            onClick={() => navigate(`/history/${entry.rollId}`)}
          />
        ))}
      </List>

      {!isFullRollView && (
        <Block strong insetMaterial outlineIos className="!my-0">
          <BlockTitle className="!mt-0">
            All-time {activeHill as HillLabel} average
          </BlockTitle>
          <p className="font-mono font-bold text-lg text-[var(--app-fg-muted)] px-4 pb-2">
            {HILL_AVERAGES[activeHill as HillLabel]}
          </p>
        </Block>
      )}
    </div>
  );
}
