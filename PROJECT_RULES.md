# Zasady Projektu Fiszki

Ten plik zawiera kluczowe zasady i wytyczne, które MUSZĄ być przestrzegane przy każdej zmianie w projekcie.

---

## 1. Synchronizacja Stanu (Real-time UI)

**ZASADA: Jeżeli coś działa w różnych miejscach, jedna akcja musi być natychmiast widoczna wszędzie, BEZ przeładowania strony.**

### Implementacja:
- Używaj systemu eventów (`lib/hooks/useReviewsSync.ts`) do komunikacji między komponentami
- Po każdej udanej operacji CRUD wywołuj `emitReviewsUpdated()`
- Komponenty nasłuchujące używają `useReviewsListener(callback)`
- Dodaj `cache: 'no-store'` + timestamp do każdego fetch dla danych dynamicznych
- Używaj `dynamic = 'force-dynamic'` w page.tsx i route.ts dla stron z dynamicznymi danymi

### Przykład:
```typescript
// Po udanej operacji
emitReviewsUpdated({ type: 'completed', reviewId })

// Nasłuchiwanie zmian
useReviewsListener(() => fetchReviews())
```

---

## 2. Jeden Komponent = Jedna Odpowiedzialność (DRY)

**ZASADA: NIE duplikuj komponentów. Jeśli dwa komponenty robią to samo, połącz je w jeden uniwersalny.**

### Przykłady:
- ❌ `ReviewScheduleManager` + `GrammarReviewScheduleManager` (źle - duplikacja)
- ✅ `ReviewScheduleManager` z propem `type: 'set' | 'grammar'` (dobrze - jeden uniwersalny)

### Jak unikać duplikacji:
1. Użyj propsów do różnicowania zachowania (`type`, `variant`, `accentColor`)
2. Użyj URL API budowanego dynamicznie na podstawie typu
3. Użyj warunkowego stylowania zamiast osobnych komponentów

---

## 3. Blokada Wielokrotnych Kliknięć

**ZASADA: Każdy przycisk wykonujący operację asynchroniczną MUSI być zablokowany podczas wykonywania.**

### Implementacja:
```typescript
const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

const handleAction = async (id: string) => {
  if (savingIds.has(id)) return // Blokuj wielokrotne kliknięcia

  setSavingIds(prev => new Set(prev).add(id))
  try {
    await fetch(...)
  } finally {
    setSavingIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }
}

// W JSX:
<button disabled={savingIds.has(id)} onClick={() => handleAction(id)}>
  {savingIds.has(id) ? '...' : 'Akcja'}
</button>
```

---

## 4. Feedback Użytkownika (Toast Notifications)

**ZASADA: Każda operacja asynchroniczna MUSI pokazywać toast z informacją o statusie.**

### Implementacja:
```typescript
import { toast } from 'sonner'

const handleAction = async () => {
  const toastId = toast.loading('Zapisywanie...')
  try {
    await fetch(...)
    toast.success('Zapisano!', { id: toastId })
  } catch {
    toast.error('Błąd połączenia', { id: toastId })
  }
}
```

---

## 5. Wyłączenie Cache dla Danych Dynamicznych

**ZASADA: Strony i API z danymi użytkownika NIE mogą być cachowane.**

### Implementacja w page.tsx:
```typescript
// Na górze pliku
export const dynamic = 'force-dynamic'
```

### Implementacja w route.ts (API):
```typescript
export const dynamic = 'force-dynamic'
export const revalidate = 0
```

### Implementacja w fetch:
```typescript
const response = await fetch(`/api/data?_t=${Date.now()}`, {
  cache: 'no-store'
})
```

---

## 6. Struktura Komponentów

### Props uniwersalnego komponentu:
```typescript
interface UniversalComponentProps {
  /** Typ określający wariant zachowania */
  type: 'variant1' | 'variant2'
  /** ID zasobu */
  resourceId: string
  /** Opcjonalny kolor akcentu */
  accentColor?: 'blue' | 'purple' | 'green'
  /** Opcjonalny wariant stylowania */
  variant?: 'card' | 'bordered' | 'minimal'
}
```

---

## 7. Checklist przed każdą zmianą

Przed commitowaniem sprawdź:

- [ ] Czy komponent emituje eventy po udanych operacjach?
- [ ] Czy powiązane komponenty nasłuchują na te eventy?
- [ ] Czy przyciski są zablokowane podczas operacji async?
- [ ] Czy są toasty informujące o statusie operacji?
- [ ] Czy fetch ma `cache: 'no-store'` i timestamp?
- [ ] Czy strona/API ma `dynamic = 'force-dynamic'`?
- [ ] Czy nie tworzysz duplikatu istniejącego komponentu?

---

## 8. Pliki kluczowe dla synchronizacji

- `lib/hooks/useReviewsSync.ts` - system eventów dla powtórek
- `components/ReviewScheduleManager.tsx` - uniwersalny manager powtórek
- `components/ReviewCalendar.tsx` - kalendarz nasłuchujący zmian

---

*Ostatnia aktualizacja: styczeń 2025*
