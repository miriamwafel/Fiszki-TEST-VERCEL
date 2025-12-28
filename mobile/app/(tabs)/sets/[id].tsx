import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { FlashcardSet, Flashcard } from '@/types/database';

export default function SetDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSetDetails();
  }, [id]);

  const fetchSetDetails = async () => {
    try {
      // Pobierz zestaw
      const { data: setData, error: setError } = await supabase
        .from('flashcard_sets')
        .select('*')
        .eq('id', id)
        .single();

      if (setError) throw setError;
      setSet(setData);

      // Pobierz fiszki
      const { data: cardsData, error: cardsError } = await supabase
        .from('flashcards')
        .select('*')
        .eq('set_id', id)
        .order('created_at', { ascending: true });

      if (cardsError) throw cardsError;
      setFlashcards(cardsData || []);
    } catch (error: any) {
      Alert.alert('Błąd', 'Nie udało się pobrać zestawu');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const renderFlashcard = ({ item, index }: { item: Flashcard; index: number }) => (
    <View style={styles.card}>
      <View style={styles.cardNumber}>
        <Text style={styles.cardNumberText}>{index + 1}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.word}>{item.word}</Text>
        <Text style={styles.translation}>{item.translation}</Text>
        {item.part_of_speech && (
          <Text style={styles.partOfSpeech}>{item.part_of_speech}</Text>
        )}
        {item.context && (
          <Text style={styles.context}>"{item.context}"</Text>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="document-outline" size={48} color="#ccc" />
      <Text style={styles.emptyText}>
        Ten zestaw nie ma jeszcze fiszek
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>Ładowanie...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: set?.name || 'Zestaw',
        }}
      />

      {/* Header z przyciskami */}
      <View style={styles.header}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{flashcards.length}</Text>
            <Text style={styles.statLabel}>fiszek</Text>
          </View>
        </View>

        {flashcards.length > 0 && (
          <TouchableOpacity
            style={styles.practiceButton}
            onPress={() => router.push(`/(tabs)/sets/practice?id=${id}`)}
          >
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.practiceButtonText}>Ćwicz</Text>
          </TouchableOpacity>
        )}
      </View>

      {set?.description && (
        <Text style={styles.description}>{set.description}</Text>
      )}

      <FlatList
        data={flashcards}
        renderItem={renderFlashcard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  stats: {
    flexDirection: 'row',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  practiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  practiceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  description: {
    padding: 16,
    fontSize: 14,
    color: '#666',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardNumber: {
    width: 40,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  word: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  translation: {
    fontSize: 16,
    color: '#666',
  },
  partOfSpeech: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  context: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 8,
  },
  empty: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
});
