// Ali so okenca na domači strani odprta. Stanje je v pomnilniku aplikacije:
// ostane, ko se premikaš med zavihki, ob osvežitvi ali novem obisku strani pa se ponastavi
// (takrat je treba spet klikniti na pljuča).
import { ref } from 'vue'

export const oknaOdprta = ref(false)
