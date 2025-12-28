import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { FlashcardSet } from '@/types/database';

type SetWithCount = FlashcardSet & { flashcard_count: number };

export default function SetsScreen() {
  const [sets, setSets] = useState<SetWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchSets = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('flashcard_sets')
        .select(`
          *,
          flashcards(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const setsWithCount = (data || []).map((set: any) => ({
        ...set,
        flashcard_count: set.flashcards?.[0]?.count || 0,
      }));

      setSets(setsWithCount);
    } catch (error: any) {
      Alert.alert('Błąd', 'Nie udało się pobrać zestawów');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSets();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSets();
  };

  const getLanguageFlag = (code: string) => {
    const flags: Record<string, string> = {
      en: '🇬🇧',
      de: '🇩🇪',
      es: '🇪🇸',
      fr: '🇫🇷',
      it: '🇮🇹',
      pt: '🇵🇹',
      ru: '🇷🇺',
      ja: '🇯🇵',
      ko: '🇰🇷',
      zh: '🇨🇳',
      nl: '🇳🇱',
      sv: '🇸🇪',
      no: '🇳🇴',
      da: '🇩🇰',
      fi: '🇫🇮',
      cs: '🇨🇿',
      uk: '🇺🇦',
    };
    return flags[code] || '🌍';
  };

  const renderSet = ({ item }: { item: SetWithCount }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/sets/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.flag}>{getLanguageFlag(item.language)}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          {item.description && (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={24} color="#999" />
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.badge}>
          <Ionicons name="documents-outline" size={14} color="#6366f1" />
          <Text style={styles.badgeText}>{item.flashcard_count} fiszek</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="folder-open-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Brak zestawów</Text>
      <Text style={styles.emptyText}>
        Stwórz swój pierwszy zestaw fiszek,{'\n'}aby rozpocząć naukę
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => Alert.alert('Info', 'Tworzenie zestawów będzie dostępne wkrótce')}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyButtonText}>Stwórz zestaw</Text>
      </TouchableOpacity>
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
      <FlatList
        data={sets}
        renderItem={renderSet}
        keyExtractor={(item) => item.id}
        contentContainerStyle={sets.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
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
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 32,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
  },
  cardFooter: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: '#6366f1',
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
