import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Flashcard } from '@/types/database';

type QuizState = 'question' | 'correct' | 'incorrect' | 'finished';

export default function PracticeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState<QuizState>('question');
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [loading, setLoading] = useState(true);
  const [shakeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    fetchFlashcards();
  }, [id]);

  const fetchFlashcards = async () => {
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('set_id', id);

      if (error) throw error;

      // Shuffle cards
      const shuffled = (data || []).sort(() => Math.random() - 0.5);
      setFlashcards(shuffled);
    } catch (error: any) {
      Alert.alert('Błąd', 'Nie udało się pobrać fiszek');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const currentCard = flashcards[currentIndex];

  const checkAnswer = () => {
    if (!answer.trim()) return;

    const isCorrect =
      answer.trim().toLowerCase() === currentCard.word.toLowerCase() ||
      (currentCard.infinitive &&
        answer.trim().toLowerCase() === currentCard.infinitive.toLowerCase());

    if (isCorrect) {
      setState('correct');
      setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
      updatePracticeStats(true);
    } else {
      setState('incorrect');
      setStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
      updatePracticeStats(false);
      shake();
    }
  };

  const updatePracticeStats = async (correct: boolean) => {
    if (!user) return;

    try {
      // Upsert practice stats
      const { data: existing } = await supabase
        .from('practice_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('flashcard_id', currentCard.id)
        .single();

      if (existing) {
        await supabase
          .from('practice_stats')
          .update({
            correct: existing.correct + (correct ? 1 : 0),
            incorrect: existing.incorrect + (correct ? 0 : 1),
            last_practice: new Date().toISOString(),
            mastered: existing.correct + (correct ? 1 : 0) >= 5,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('practice_stats')
          .insert({
            user_id: user.id,
            flashcard_id: currentCard.id,
            correct: correct ? 1 : 0,
            incorrect: correct ? 0 : 1,
            last_practice: new Date().toISOString(),
            mastered: false,
          });
      }
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const nextCard = () => {
    if (currentIndex + 1 >= flashcards.length) {
      setState('finished');
    } else {
      setCurrentIndex(prev => prev + 1);
      setAnswer('');
      setState('question');
    }
  };

  const restartQuiz = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentIndex(0);
    setAnswer('');
    setState('question');
    setStats({ correct: 0, incorrect: 0 });
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>Ładowanie...</Text>
      </View>
    );
  }

  if (flashcards.length === 0) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Quiz' }} />
        <Ionicons name="document-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>Brak fiszek do ćwiczenia</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Wróć</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (state === 'finished') {
    const total = stats.correct + stats.incorrect;
    const percentage = Math.round((stats.correct / total) * 100);

    return (
      <View style={styles.finished}>
        <Stack.Screen options={{ title: 'Wynik' }} />

        <View style={styles.resultIcon}>
          {percentage >= 70 ? (
            <Ionicons name="trophy" size={64} color="#fbbf24" />
          ) : percentage >= 50 ? (
            <Ionicons name="thumbs-up" size={64} color="#6366f1" />
          ) : (
            <Ionicons name="refresh" size={64} color="#999" />
          )}
        </View>

        <Text style={styles.resultTitle}>
          {percentage >= 70 ? 'Świetnie!' : percentage >= 50 ? 'Nieźle!' : 'Spróbuj jeszcze raz'}
        </Text>

        <Text style={styles.resultScore}>{percentage}%</Text>

        <View style={styles.resultStats}>
          <View style={styles.resultStat}>
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            <Text style={styles.resultStatText}>{stats.correct} poprawnych</Text>
          </View>
          <View style={styles.resultStat}>
            <Ionicons name="close-circle" size={24} color="#ef4444" />
            <Text style={styles.resultStatText}>{stats.incorrect} błędnych</Text>
          </View>
        </View>

        <View style={styles.resultButtons}>
          <TouchableOpacity
            style={[styles.button, styles.buttonOutline]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonOutlineText}>Wróć do zestawu</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={restartQuiz}>
            <Text style={styles.buttonText}>Ćwicz ponownie</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${currentIndex + 1} / ${flashcards.length}` }} />

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentIndex + 1) / flashcards.length) * 100}%` },
          ]}
        />
      </View>

      {/* Question card */}
      <Animated.View
        style={[
          styles.questionCard,
          { transform: [{ translateX: shakeAnim }] },
          state === 'correct' && styles.cardCorrect,
          state === 'incorrect' && styles.cardIncorrect,
        ]}
      >
        <Text style={styles.questionLabel}>Jak to powiedzieć?</Text>
        <Text style={styles.questionText}>{currentCard.translation}</Text>

        {currentCard.context && (
          <Text style={styles.contextHint}>Kontekst: {currentCard.context}</Text>
        )}

        {state !== 'question' && (
          <View style={styles.answerReveal}>
            <Text style={styles.answerLabel}>Poprawna odpowiedź:</Text>
            <Text style={styles.correctAnswer}>{currentCard.word}</Text>
            {currentCard.infinitive && (
              <Text style={styles.infinitive}>
                (bezokolicznik: {currentCard.infinitive})
              </Text>
            )}
          </View>
        )}
      </Animated.View>

      {/* Answer input */}
      {state === 'question' ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Wpisz odpowiedź..."
            value={answer}
            onChangeText={setAnswer}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={checkAnswer}
          />
          <TouchableOpacity
            style={[styles.checkButton, !answer.trim() && styles.checkButtonDisabled]}
            onPress={checkAnswer}
            disabled={!answer.trim()}
          >
            <Ionicons name="checkmark" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.nextButton} onPress={nextCard}>
          <Text style={styles.nextButtonText}>
            {currentIndex + 1 >= flashcards.length ? 'Zobacz wynik' : 'Następna fiszka'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Current stats */}
      <View style={styles.currentStats}>
        <View style={styles.currentStat}>
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <Text style={styles.currentStatText}>{stats.correct}</Text>
        </View>
        <View style={styles.currentStat}>
          <Ionicons name="close-circle" size={20} color="#ef4444" />
          <Text style={styles.currentStatText}>{stats.incorrect}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 3,
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardCorrect: {
    borderColor: '#22c55e',
    borderWidth: 2,
  },
  cardIncorrect: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  questionLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  contextHint: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
  },
  answerReveal: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  answerLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  correctAnswer: {
    fontSize: 24,
    fontWeight: '600',
    color: '#6366f1',
  },
  infinitive: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  checkButton: {
    width: 56,
    height: 56,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonDisabled: {
    backgroundColor: '#c7c7c7',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  currentStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  currentStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentStatText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  finished: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultIcon: {
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 32,
  },
  resultStats: {
    marginBottom: 32,
  },
  resultStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultStatText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  resultButtons: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  buttonOutlineText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
});
