import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';

import { F1_CARDS, STAT_LABELS, type GameDriver, type GameStat } from '@/lib/game-data';

type State = 'ready' | 'playerTurn' | 'aiThinking' | 'revealing' | 'roundResult' | 'finished';
type Winner = 'player' | 'ai' | 'draw' | null;

const TOTAL_ROUNDS = 10;

export default function TopTrumpsGame() {
  const router = useRouter();
  const [state, setState] = useState<State>('ready');
  const [playerDeck, setPlayerDeck] = useState<GameDriver[]>([]);
  const [aiDeck, setAiDeck] = useState<GameDriver[]>([]);
  const [roundNum, setRoundNum] = useState(0);
  const [selectedStat, setSelectedStat] = useState<GameStat | null>(null);
  const [roundWinner, setRoundWinner] = useState<Winner>(null);
  const [revealed, setRevealed] = useState(false);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [message, setMessage] = useState('');

  const playerCard = playerDeck[roundNum - 1];
  const aiCard = aiDeck[roundNum - 1];

  const startGame = () => {
    const shuffled = [...F1_CARDS].sort(() => Math.random() - 0.5);
    const p = shuffled.slice(0, 10);
    const a = shuffled.slice(10, 20);
    setPlayerDeck(p);
    setAiDeck(a);
    setRoundNum(1);
    setIsPlayerTurn(true);
    setSelectedStat(null);
    setRevealed(false);
    setRoundWinner(null);
    setScore({ player: 0, ai: 0 });
    setState('playerTurn');
    setMessage('Выбери характеристику!');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectStat = (stat: GameStat) => {
    if (state !== 'playerTurn' || !isPlayerTurn) return;
    setSelectedStat(stat);
    setRevealed(true);
    setState('revealing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const pVal = playerCard!.stats[stat];
    const aVal = aiCard!.stats[stat];
    setTimeout(() => {
      let winner: Winner;
      if (pVal > aVal) {
        winner = 'player';
        setMessage(`${STAT_LABELS[stat].icon} ${pVal} > ${aVal} — Ты выиграл!`);
        setScore((s) => ({ ...s, player: s.player + 1 }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (aVal > pVal) {
        winner = 'ai';
        setMessage(`${STAT_LABELS[stat].icon} ${pVal} < ${aVal} — AI выиграл!`);
        setScore((s) => ({ ...s, ai: s.ai + 1 }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        winner = 'draw';
        setMessage(`${STAT_LABELS[stat].icon} ${pVal} = ${aVal} — Ничья!`);
      }
      setRoundWinner(winner);
      setState('roundResult');
    }, 800);
  };

  const nextRound = () => {
    if (roundNum >= TOTAL_ROUNDS) {
      setState('finished');
      return;
    }
    setRoundNum(roundNum + 1);
    setSelectedStat(null);
    setRevealed(false);
    setRoundWinner(null);
    const aiTurn = roundWinner === 'ai';
    setIsPlayerTurn(!aiTurn);

    if (aiTurn) {
      setState('aiThinking');
      setMessage('🤖 AI думает...');
      setTimeout(() => {
        const ac = aiDeck[roundNum]; // 0-indexed via state's pending update; use roundNum prev
        // Re-resolve current card
        const aiCardNow = aiDeck[roundNum]; // because roundNum has just been bumped
        const playerCardNow = playerDeck[roundNum];
        const keys = Object.keys(aiCardNow.stats) as GameStat[];
        let best = keys[0];
        keys.forEach((k) => {
          if (aiCardNow.stats[k] > aiCardNow.stats[best]) best = k;
        });
        setSelectedStat(best);
        setRevealed(true);
        setState('revealing');
        const pV = playerCardNow.stats[best];
        const aV = aiCardNow.stats[best];
        setTimeout(() => {
          let w: Winner;
          if (pV > aV) {
            w = 'player';
            setMessage(`AI: ${STAT_LABELS[best].icon} ${aV} < ${pV}. Ты выиграл!`);
            setScore((s) => ({ ...s, player: s.player + 1 }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else if (aV > pV) {
            w = 'ai';
            setMessage(`AI: ${STAT_LABELS[best].icon} ${aV} > ${pV}. AI выиграл!`);
            setScore((s) => ({ ...s, ai: s.ai + 1 }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } else {
            w = 'draw';
            setMessage('Ничья!');
          }
          setRoundWinner(w);
          setState('roundResult');
        }, 800);
      }, 1200);
    } else {
      setState('playerTurn');
      setMessage('Твой ход! Выбери характеристику.');
    }
  };

  // === RENDER ===

  if (state === 'ready') {
    return (
      <View className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="px-4 pt-2 pb-2 flex-row items-center">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full items-center justify-center">
              <Ionicons name="chevron-back" size={24} color="#FAFAFA" />
            </Pressable>
            <Text className="text-text text-lg font-bold flex-1 text-center mr-10">
              🃏 Top Trumps
            </Text>
          </View>
          <View className="flex-1 items-center justify-center px-6">
            <Text style={{ fontSize: 90 }}>🃏</Text>
            <Text className="text-text text-2xl font-extrabold mt-4">F1 Top Trumps</Text>
            <Text className="text-muted text-sm text-center mt-2 leading-5">
              20 пилотов F1 · 5 характеристик{'\n'}
              Выбирай стат — у кого больше, тот выигрывает!
            </Text>
            <Text className="text-muted-2 text-xs mt-2">10 раундов · Ты vs AI</Text>
            <Pressable
              onPress={startGame}
              className="rounded-2xl px-10 py-4 mt-8 active:opacity-80"
              style={{ backgroundColor: '#E10600' }}>
              <Text className="text-text font-extrabold text-base">РАЗДАТЬ КАРТЫ</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (state === 'finished') {
    return (
      <View className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="px-4 pt-2 pb-2 flex-row items-center">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full items-center justify-center">
              <Ionicons name="chevron-back" size={24} color="#FAFAFA" />
            </Pressable>
            <Text className="text-text text-lg font-bold flex-1 text-center mr-10">
              🃏 Top Trumps
            </Text>
          </View>
          <View className="flex-1 items-center justify-center px-6">
            <Text style={{ fontSize: 90 }}>
              {score.player > score.ai ? '🏆' : score.player < score.ai ? '😤' : '🤝'}
            </Text>
            <Text
              className="text-3xl font-extrabold mt-3"
              style={{
                color:
                  score.player > score.ai
                    ? '#4CAF50'
                    : score.player < score.ai
                      ? '#f44336'
                      : '#FF9800',
              }}>
              {score.player > score.ai ? 'ПОБЕДА!' : score.player < score.ai ? 'ПОРАЖЕНИЕ' : 'НИЧЬЯ'}
            </Text>
            <Text className="text-text text-4xl font-extrabold mt-2">
              {score.player} : {score.ai}
            </Text>
            <Text className="text-muted text-sm mt-3 text-center">
              {score.player > score.ai
                ? 'Ты настоящий стратег!'
                : score.player < score.ai
                  ? 'AI оказался хитрее. Попробуй ещё!'
                  : 'Достойная битва!'}
            </Text>
            <View className="flex-row gap-3 mt-8">
              <Pressable
                onPress={startGame}
                className="rounded-2xl px-6 py-3 active:opacity-80"
                style={{ backgroundColor: '#E10600' }}>
                <Text className="text-text font-bold">Играть снова</Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                className="bg-surface rounded-2xl px-6 py-3 border border-line">
                <Text className="text-text font-bold">Назад</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // === ROUND IN PROGRESS ===
  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 pt-2 pb-2 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center">
            <Ionicons name="chevron-back" size={24} color="#FAFAFA" />
          </Pressable>
          <Text className="text-text text-lg font-bold flex-1 text-center mr-10">
            🃏 Top Trumps
          </Text>
        </View>

        {/* Scoreboard */}
        <View className="mx-4 mb-2 bg-surface rounded-xl border border-line px-4 py-2.5 flex-row items-center justify-between">
          <View className="items-center">
            <Text className="text-muted text-[10px]">Ты</Text>
            <Text className="text-green-500 font-extrabold text-2xl">{score.player}</Text>
          </View>
          <View className="items-center">
            <Text className="text-muted text-[11px] font-bold">
              Раунд {roundNum}/{TOTAL_ROUNDS}
            </Text>
            <Text className="text-muted-2 text-[10px] mt-0.5">
              {isPlayerTurn ? '🟢 Твой ход' : '🔴 Ход AI'}
            </Text>
          </View>
          <View className="items-center">
            <Text className="text-muted text-[10px]">AI</Text>
            <Text className="text-red font-extrabold text-2xl">{score.ai}</Text>
          </View>
        </View>

        {message ? (
          <Text className="text-muted text-xs text-center mb-2 px-4">{message}</Text>
        ) : null}

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 120 }}>
          <View className="flex-row items-start" style={{ gap: 4 }}>
            <View style={{ flex: 1 }}>
              <Text className="text-muted text-[10px] font-extrabold text-center mb-1">
                ТВОЯ КАРТА
              </Text>
              {playerCard && (
                <DriverCard
                  driver={playerCard}
                  isPlayer
                  revealed
                  selectedStat={selectedStat}
                  wonStat={
                    roundWinner === 'player' ? true : roundWinner === 'ai' ? false : null
                  }
                  onSelectStat={state === 'playerTurn' && isPlayerTurn ? selectStat : null}
                />
              )}
            </View>
            <View className="items-center justify-center self-center mx-1">
              <Text className="text-red font-extrabold text-base">VS</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-muted text-[10px] font-extrabold text-center mb-1">
                КАРТА AI
              </Text>
              {aiCard ? (
                revealed ? (
                  <DriverCard
                    driver={aiCard}
                    revealed
                    selectedStat={selectedStat}
                    wonStat={
                      roundWinner === 'ai' ? true : roundWinner === 'player' ? false : null
                    }
                  />
                ) : (
                  <CardBack count={aiDeck.length - roundNum + 1} />
                )
              ) : null}
            </View>
          </View>

          {state === 'roundResult' && (
            <View className="items-center mt-4">
              <Pressable
                onPress={nextRound}
                className="rounded-xl px-8 py-3 active:opacity-80"
                style={{
                  backgroundColor:
                    roundWinner === 'player'
                      ? '#4CAF50'
                      : roundWinner === 'ai'
                        ? '#f44336'
                        : '#666',
                }}>
                <Text className="text-text font-bold">
                  {roundNum >= TOTAL_ROUNDS ? 'Результат' : 'Следующий раунд →'}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============ COMPONENTS ============

function DriverCard({
  driver,
  isPlayer,
  revealed,
  selectedStat,
  wonStat,
  onSelectStat,
}: {
  driver: GameDriver;
  isPlayer?: boolean;
  revealed: boolean;
  selectedStat: GameStat | null;
  wonStat: boolean | null;
  onSelectStat?: ((s: GameStat) => void) | null;
}) {
  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: driver.teamColor + '20',
        borderWidth: 2,
        borderColor: driver.teamColor,
      }}>
      {/* Photo header */}
      <View style={{ height: 110, position: 'relative' }}>
        <Image
          source={{ uri: driver.photo }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          contentPosition="top"
        />
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.0)',
          }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              top: '50%',
              backgroundColor: 'transparent',
            }}
          />
        </View>
        {/* Team chip */}
        <View
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: driver.teamColor + 'CC',
          }}>
          <Text className="text-text font-bold" style={{ fontSize: 8 }}>
            {driver.team}
          </Text>
        </View>
        {/* Number */}
        <Text
          style={{
            position: 'absolute',
            top: 0,
            right: 6,
            fontWeight: '900',
            fontStyle: 'italic',
            fontSize: 32,
            color: driver.teamColor + '55',
          }}>
          {driver.number}
        </Text>
        {/* Name + country */}
        <View style={{ position: 'absolute', bottom: 4, left: 6, right: 6 }}>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9 }}>
            {driver.country} {driver.code}
          </Text>
          <Text
            className="text-text font-extrabold"
            style={{ fontSize: 13, lineHeight: 14 }}
            numberOfLines={1}>
            {driver.name}
          </Text>
        </View>
      </View>
      {/* Stats list */}
      <View style={{ padding: 5 }}>
        {(Object.keys(STAT_LABELS) as GameStat[]).map((key) => {
          const isSel = selectedStat === key;
          const info = STAT_LABELS[key];
          const bg = isSel
            ? wonStat === true
              ? 'rgba(76,175,80,0.18)'
              : wonStat === false
                ? 'rgba(244,67,54,0.18)'
                : driver.teamColor + '33'
            : 'rgba(255,255,255,0.03)';
          const border = isSel
            ? wonStat === true
              ? '#4CAF50'
              : wonStat === false
                ? '#f44336'
                : driver.teamColor
            : 'transparent';
          return (
            <Pressable
              key={key}
              onPress={() => onSelectStat?.(key)}
              disabled={!onSelectStat || !isPlayer}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 4,
                paddingHorizontal: 6,
                marginVertical: 1,
                borderRadius: 6,
                backgroundColor: bg,
                borderWidth: 1,
                borderColor: border,
              }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600' }}>
                {info.icon} {info.label}
              </Text>
              <Text
                style={{
                  color: revealed || isPlayer ? '#fff' : 'transparent',
                  fontWeight: '800',
                  fontSize: 12,
                }}>
                {revealed || isPlayer ? driver.stats[key] : '?'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: 3, backgroundColor: driver.teamColor }} />
    </View>
  );
}

function CardBack({ count }: { count: number }) {
  return (
    <View
      className="items-center justify-center rounded-2xl"
      style={{
        height: 280,
        backgroundColor: '#E10600',
        borderWidth: 2,
        borderColor: '#E10600',
      }}>
      <Text style={{ fontSize: 40 }}>🏎️</Text>
      <Text
        className="text-text font-extrabold mt-2"
        style={{ fontSize: 18, fontStyle: 'italic' }}>
        F1
      </Text>
      <Text className="text-text/60 text-xs mt-2">{count} карт</Text>
    </View>
  );
}
