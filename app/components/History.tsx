import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Block,
  BlockTitle,
  Button,
  Icon,
  List,
  ListInput,
  ListItem,
  Navbar,
  NavbarBackLink,
} from 'konsta/react';
import { ChevronRight, Thermometer, Wind, DropFill, Cube } from 'framework7-icons/react';
import {
  MdChevronRight,
  MdThermostat,
  MdAir,
  MdWaterDrop,
  MdStorage,
} from 'react-icons/md';
import { BUGGY_OPTIONS, HILL_AVERAGES, HILL_LABEL_TO_STATION, SUPPORT_EMAIL } from '../config/app.config';
import type { HillLabel } from '../config/app.config';
import { formatTime, parseFormattedTime } from '../domain/timing';
import {
  buildRollRequestMailto,
  filterAndSortRolls,
  formatDriverBuggy,
  type RollListFilters,
  type SavedRoll,
} from '../domain/rolls';
import { useAppStore } from '../store';
import { LoadingIndicator } from './shared/LoadingIndicator';
import { FlaggerNotesSection } from './shared/FlaggerNotesSection';
import { RollNotesSection } from './shared/RollNotesSection';
import { RollDriverSection } from './shared/RollDriverSection';
import { SplitTimeRow } from './shared/SplitTimeRow';
import { AnimatedPanelOverlay } from './shared/AnimatedPanelOverlay';
import { WeatherModal } from './shared/WeatherModal';

export default function History() {
  const { rollId } = useParams();
  const navigate = useNavigate();
  const savedRolls = useAppStore((s) => s.savedRolls);
  const rollsLoadStatus = useAppStore((s) => s.rollsLoadStatus);
  const refreshSavedRolls = useAppStore((s) => s.refreshSavedRolls);
  const updateSavedRollNotes = useAppStore((s) => s.updateSavedRollNotes);
  const lastViewedRollId = useAppStore((s) => s.lastViewedRollId);
  const highlightLogsOnNextList = useAppStore((s) => s.highlightLogsOnNextList);
  const setLastViewedRollId = useAppStore((s) => s.setLastViewedRollId);
  const setHighlightLogsOnNextList = useAppStore((s) => s.setHighlightLogsOnNextList);
  const deleteSavedRoll = useAppStore((s) => s.deleteSavedRoll);

  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [requestModal, setRequestModal] = useState<'modification' | 'deletion' | null>(null);
  const [driverQuery, setDriverQuery] = useState('');
  const [buggyFilter, setBuggyFilter] = useState('all');
  const [sortBy, setSortBy] = useState<RollListFilters['sortBy']>('date');
  const [highlightRollId, setHighlightRollId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    void refreshSavedRolls();
  }, [refreshSavedRolls]);

  const selectedRoll = useMemo(() => {
    if (!rollId) return null;
    return savedRolls.find((r) => r.id === rollId) ?? null;
  }, [rollId, savedRolls]);

  useEffect(() => {
    if (selectedRoll) setLastViewedRollId(selectedRoll.id);
  }, [selectedRoll, setLastViewedRollId]);

  const filteredRolls = useMemo(
    () =>
      filterAndSortRolls(savedRolls, {
        driverQuery,
        buggy: buggyFilter,
        sortBy,
      }),
    [savedRolls, driverQuery, buggyFilter, sortBy],
  );

  useLayoutEffect(() => {
    if (rollId || !highlightLogsOnNextList || !lastViewedRollId) return;

    const rollExists = filteredRolls.some((r) => r.id === lastViewedRollId);
    if (!rollExists) {
      setHighlightLogsOnNextList(false);
      return;
    }

    const card = cardRefs.current[lastViewedRollId];
    if (!card) {
      setHighlightLogsOnNextList(false);
      return;
    }

    card.scrollIntoView({ block: 'center', behavior: 'auto' });
    setHighlightRollId(lastViewedRollId);
    setHighlightLogsOnNextList(false);

    const t = setTimeout(() => setHighlightRollId(null), 1000);
    return () => clearTimeout(t);
  }, [rollId, highlightLogsOnNextList, lastViewedRollId, filteredRolls, setHighlightLogsOnNextList]);

  if (rollId && !selectedRoll) {
    return (
      <Block className="text-center">
        <p>Roll not found.</p>
        <Button className="mt-4" onClick={() => navigate('/history')}>
          Back to Logs
        </Button>
      </Block>
    );
  }

  if (selectedRoll) {
    return (
      <HistoryDetail
        roll={selectedRoll}
        showWeatherModal={showWeatherModal}
        setShowWeatherModal={setShowWeatherModal}
        requestModal={requestModal}
        setRequestModal={setRequestModal}
        onNotesChange={(notes) => void updateSavedRollNotes(selectedRoll.id, notes)}
        onDelete={() => {
          void deleteSavedRoll(selectedRoll.id);
          setRequestModal(null);
          navigate('/history');
        }}
      />
    );
  }

  if (rollsLoadStatus === 'loading' && savedRolls.length === 0) {
    return <LoadingIndicator label="Loading logs…" className="min-h-[40vh]" />;
  }

  return (
    <div className="py-4 px-4 flex flex-col gap-4 min-h-full">
      <List strongIos outlineIos insetMaterial>
        <ListInput
          type="text"
          placeholder="Filter by driver…"
          value={driverQuery}
          onChange={(e) => setDriverQuery((e.target as HTMLInputElement).value)}
        />
        <ListInput
          type="select"
          value={buggyFilter}
          onChange={(e) => setBuggyFilter((e.target as HTMLSelectElement).value)}
        >
          <option value="all">All buggies</option>
          {BUGGY_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </ListInput>
        <ListInput
          type="select"
          value={sortBy}
          onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as RollListFilters['sortBy'])}
        >
          <option value="date">Sort by date</option>
          <option value="total">Sort by total time</option>
        </ListInput>
      </List>

      {filteredRolls.length === 0 && (
        <p className="text-center text-[var(--app-fg-muted)] py-8">No rolls match your filters.</p>
      )}

      <List strongIos outlineIos insetMaterial>
        {filteredRolls.map((roll) => {
          const isHighlight = highlightRollId === roll.id;
          const isCancelled = roll.status === 'cancelled' || roll.totalMs < 0;
          return (
            <ListItem
              key={roll.id}
              ref={(el) => {
                if (el) cardRefs.current[roll.id] = el as unknown as HTMLElement;
                else delete cardRefs.current[roll.id];
              }}
              link
              title={formatDriverBuggy(roll.driver, roll.buggy)}
              subtitle={`${roll.dateDisplay} · ${roll.timeDisplay}`}
              after={
                <span className="flex items-center gap-2">
                  <span className="text-primary font-semibold text-sm">{roll.total}</span>
                  <Icon
                    ios={<ChevronRight className="w-5 h-5 opacity-50" />}
                    material={<MdChevronRight className="w-5 h-5 opacity-50" />}
                  />
                </span>
              }
              onClick={() => navigate(`/history/${roll.id}`)}
              className={
                isHighlight
                  ? 'bg-primary/20'
                  : isCancelled
                    ? 'opacity-70'
                    : undefined
              }
            />
          );
        })}
      </List>
    </div>
  );
}

function HistoryDetail({
  roll,
  showWeatherModal,
  setShowWeatherModal,
  requestModal,
  setRequestModal,
  onNotesChange,
  onDelete,
}: {
  roll: SavedRoll;
  showWeatherModal: boolean;
  setShowWeatherModal: (v: boolean) => void;
  requestModal: 'modification' | 'deletion' | null;
  setRequestModal: (v: 'modification' | 'deletion' | null) => void;
  onNotesChange: (notes: string) => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const isDeletion = requestModal === 'deletion';

  const isSplitFlagged = (label: string) => {
    const stationId = HILL_LABEL_TO_STATION[label as HillLabel];
    return stationId ? roll.unreliableStations.includes(stationId) : false;
  };

  return (
    <div className="py-2 px-4 flex flex-col gap-4 pb-10 relative">
      <WeatherModal open={showWeatherModal} onClose={() => setShowWeatherModal(false)} />

      <AnimatedPanelOverlay
        open={requestModal !== null}
        onClose={() => setRequestModal(null)}
        origin="top"
        title={isDeletion ? 'Request deletion' : 'Request modification'}
        footer={
          isDeletion ? (
            <>
              <Button large tonal className="k-color-brand-red w-full" onClick={onDelete}>
                Delete now
              </Button>
              <Button
                large
                className="k-color-brand-red w-full"
                href={buildRollRequestMailto(roll, 'deletion', SUPPORT_EMAIL)}
              >
                Email request
              </Button>
            </>
          ) : (
            <Button
              large
              className="w-full"
              href={buildRollRequestMailto(roll, 'modification', SUPPORT_EMAIL)}
            >
              Email request
            </Button>
          )
        }
      >
        <p className="text-sm leading-relaxed text-center">
          {isDeletion
            ? 'Remove this roll from logs immediately, or email a deletion request for the database manager.'
            : 'A database manager will handle this modification manually. Tap below to open an email with roll details pre-filled.'}
        </p>
      </AnimatedPanelOverlay>

      <Navbar
        title="Past roll summary"
        left={<NavbarBackLink text="Back" onClick={() => navigate('/history')} />}
        className="!relative !top-auto"
      />

      <List strongIos outlineIos insetMaterial>
        <ListItem
          link
          title="Start"
          after={roll.timeDisplay}
          subtitle={roll.dateDisplay}
          onClick={() => setShowWeatherModal(true)}
        />
        <ListItem
          title="Weather"
          subtitle={`${roll.weather.temp} · ${roll.weather.wind} · ${roll.weather.humidity}`}
          onClick={() => setShowWeatherModal(true)}
          media={
            <span className="flex items-center gap-2">
              <Icon
                ios={<Thermometer className="w-5 h-5 text-red-500" />}
                material={<MdThermostat className="w-5 h-5 text-red-500" />}
              />
              <Icon
                ios={<Wind className="w-5 h-5 opacity-70" />}
                material={<MdAir className="w-5 h-5 opacity-70" />}
              />
              <Icon
                ios={<DropFill className="w-5 h-5 text-blue-500" />}
                material={<MdWaterDrop className="w-5 h-5 text-blue-500" />}
              />
            </span>
          }
        />
      </List>

      <RollNotesSection notes={roll.notes} onChange={onNotesChange} />
      {roll.flaggerNotes?.length > 0 && (
        <FlaggerNotesSection notes={roll.flaggerNotes} readOnly />
      )}
      <RollDriverSection driver={roll.driver} buggy={roll.buggy} />

      <Block strong insetMaterial outlineIos className="!my-0 !p-0 overflow-hidden">
        <BlockTitle className="px-4">Split times</BlockTitle>
        <div className="flex flex-col">
          {roll.splits.map((s, i) => {
            const avgStr = HILL_AVERAGES[s.label as HillLabel];
            const avgMs = avgStr ? parseFormattedTime(avgStr) : -1;
            const splitMs = s.splitMs;
            const deltaMs = splitMs > 0 && avgMs > 0 ? splitMs - avgMs : null;
            const deltaStr = deltaMs !== null
              ? `${deltaMs > 0 ? '+' : '-'}${formatTime(Math.abs(deltaMs))}`
              : null;

            return (
              <SplitTimeRow
                key={i}
                label={s.label}
                pusher={s.pusher}
                time={s.time}
                flagged={isSplitFlagged(s.label)}
                delta={deltaStr}
                deltaPositive={deltaMs !== null ? deltaMs > 0 : undefined}
              />
            );
          })}
          <div className="flex justify-between items-center p-5 bg-primary/10">
            <span className="font-bold text-primary">Total elapsed time</span>
            <span className="font-mono font-bold text-xl text-primary">{roll.total}</span>
          </div>
        </div>
      </Block>

      <Button large disabled className="mx-4 opacity-50">
        <Icon
          ios={<Cube className="w-5 h-5 mr-2" />}
          material={<MdStorage className="w-5 h-5 mr-2" />}
        />
        Exported to SRS database
      </Button>

      {roll.videoUrl && (
        <Block>
          <a href={roll.videoUrl} rel="noopener noreferrer">
            <Button large tonal className="w-full">
              Watch video
            </Button>
          </a>
        </Block>
      )}

      <Block className="flex flex-col gap-2">
        <Button large tonal onClick={() => setRequestModal('modification')}>
          Request modification
        </Button>
        <Button large tonal className="k-color-brand-red" onClick={() => setRequestModal('deletion')}>
          Request deletion
        </Button>
      </Block>
    </div>
  );
}
