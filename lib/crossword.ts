import seedPuzzles from "./seed-puzzles.json";

export type WordEntry = { answer: string; clue: string };
export type PuzzleDefinition = {
  id: string;
  title: string;
  description: string;
  emoji?: string;
  words: WordEntry[];
};
export type Direction = "across" | "down";
export type PlacedWord = WordEntry & {
  id: string;
  answer: string;
  row: number;
  col: number;
  direction: Direction;
  number: number;
};
export type GridCell = {
  row: number;
  col: number;
  letter: string;
  wordIds: string[];
  number?: number;
};

export const DEFAULT_PUZZLES: PuzzleDefinition[] = [
  ...(seedPuzzles as PuzzleDefinition[]),
  {
    id: "space",
    title: "Тайны космоса",
    description: "От Луны до далёких галактик",
    emoji: "✦",
    words: [
      { answer: "ГАЛАКТИКА", clue: "Огромная система из звёзд, газа и пыли" },
      { answer: "СПУТНИК", clue: "Тело, которое движется вокруг планеты" },
      { answer: "ПЛАНЕТА", clue: "Небесное тело на орбите звезды" },
      { answer: "РАКЕТА", clue: "Космический транспорт с реактивным двигателем" },
      { answer: "ОРБИТА", clue: "Путь небесного тела в пространстве" },
      { answer: "КОМЕТА", clue: "Ледяная странница с ярким хвостом" },
      { answer: "ЗВЕЗДА", clue: "Светящийся газовый шар" },
      { answer: "ВАКУУМ", clue: "Пространство почти без вещества" },
      { answer: "МАРС", clue: "Красная планета" },
      { answer: "ЛУНА", clue: "Естественный спутник Земли" },
    ],
  },
  {
    id: "cinema",
    title: "Магия кино",
    description: "Всё, что происходит по обе стороны камеры",
    emoji: "◉",
    words: [
      { answer: "РЕЖИССЕР", clue: "Руководит творческим процессом съёмок" },
      { answer: "СЦЕНАРИЙ", clue: "Литературная основа будущего фильма" },
      { answer: "ПРЕМЬЕРА", clue: "Первый публичный показ картины" },
      { answer: "МОНТАЖ", clue: "Соединение отснятых фрагментов" },
      { answer: "КАМЕРА", clue: "Главный инструмент оператора" },
      { answer: "АКТЕР", clue: "Исполнитель роли" },
      { answer: "КАДР", clue: "Отдельное изображение на плёнке или экране" },
      { answer: "ТИТРЫ", clue: "Список создателей фильма" },
    ],
  },
];

export const SAMPLE_JSON = JSON.stringify(
  {
    id: "coffee",
    title: "Кофейная пауза",
    description: "Небольшой кроссворд для бодрого утра",
    emoji: "☕",
    words: [
      { answer: "АРАБИКА", clue: "Самый распространённый сорт кофе" },
      { answer: "БАРИСТА", clue: "Мастер приготовления кофе" },
      { answer: "ЭСПРЕССО", clue: "Крепкая основа многих кофейных напитков" },
      { answer: "ТУРКА", clue: "Посуда для кофе по-восточному" },
      { answer: "ПЕНКА", clue: "Воздушный слой на капучино" },
    ],
  },
  null,
  2,
);

export function cleanAnswer(value: string) {
  return value.toLocaleUpperCase("ru-RU").replace(/[^А-ЯЁA-Z0-9]/g, "");
}

export function cellKey(row: number, col: number) {
  return String(row) + ":" + String(col);
}

export function buildCrossword(words: WordEntry[]) {
  const prepared = words
    .map((word, sourceIndex) => ({
      ...word,
      answer: cleanAnswer(word.answer),
      sourceIndex,
    }))
    .filter((word) => word.answer.length > 1)
    .sort((a, b) => b.answer.length - a.answer.length);
  if (!prepared.length) return { cells: {}, placed: [], rows: 0, cols: 0 };

  type PreparedWord = (typeof prepared)[number];
  type RawPlacedWord = Omit<PlacedWord, "number"> & { sourceIndex: number };
  const longestWord = Math.max(...prepared.map((word) => word.answer.length));
  const size = Math.max(31, longestWord * 2 + 5, prepared.length * 2 + 5);
  const center = Math.floor(size / 2);

  const createOrder = (attempt: number) => {
    if (attempt === 0) return prepared;
    let seed = 2166136261 ^ attempt;
    prepared.forEach((word) => {
      for (const character of word.answer) {
        seed ^= character.charCodeAt(0);
        seed = Math.imul(seed, 16777619);
      }
    });
    const random = () => {
      seed += 0x6d2b79f5;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const first = prepared[attempt % Math.min(prepared.length, 10)];
    const rest = prepared
      .filter((word) => word !== first)
      .map((word) => ({ word, rank: word.answer.length * 4 + random() * 7 }))
      .sort((a, b) => b.rank - a.rank)
      .map(({ word }) => word);
    return [first, ...rest];
  };

  const attemptLayout = (orderedWords: PreparedWord[]) => {
    const occupied = new Map<
      string,
      { letter: string; across: boolean; down: boolean; wordIds: string[] }
    >();
    const rawPlaced: RawPlacedWord[] = [];

    const place = (
      word: PreparedWord,
      row: number,
      col: number,
      direction: Direction,
    ) => {
      const id = "word-" + word.sourceIndex;
      word.answer.split("").forEach((letter, index) => {
        const nextRow = row + (direction === "down" ? index : 0);
        const nextCol = col + (direction === "across" ? index : 0);
        const key = cellKey(nextRow, nextCol);
        const current = occupied.get(key);
        occupied.set(key, {
          letter,
          across: current?.across || direction === "across",
          down: current?.down || direction === "down",
          wordIds: [...(current?.wordIds || []), id],
        });
      });
      rawPlaced.push({
        id,
        answer: word.answer,
        clue: word.clue,
        row,
        col,
        direction,
        sourceIndex: word.sourceIndex,
      });
    };

    const first = orderedWords[0];
    place(
      first,
      center,
      center - Math.floor(first.answer.length / 2),
      "across",
    );

    for (const word of orderedWords.slice(1)) {
      let best:
        | { row: number; col: number; direction: Direction; score: number }
        | undefined;
      for (const [key, existing] of occupied.entries()) {
        const [existingRow, existingCol] = key.split(":").map(Number);
        word.answer.split("").forEach((letter, letterIndex) => {
          if (letter !== existing.letter) return;
          (["across", "down"] as Direction[]).forEach((direction) => {
            if (
              (direction === "across" && existing.across) ||
              (direction === "down" && existing.down)
            ) return;
            const row = existingRow - (direction === "down" ? letterIndex : 0);
            const col = existingCol - (direction === "across" ? letterIndex : 0);
            const endRow =
              row + (direction === "down" ? word.answer.length - 1 : 0);
            const endCol =
              col + (direction === "across" ? word.answer.length - 1 : 0);
            if (row < 1 || col < 1 || endRow >= size - 1 || endCol >= size - 1)
              return;
            const beforeKey = cellKey(
              row - (direction === "down" ? 1 : 0),
              col - (direction === "across" ? 1 : 0),
            );
            const afterKey = cellKey(
              endRow + (direction === "down" ? 1 : 0),
              endCol + (direction === "across" ? 1 : 0),
            );
            if (occupied.has(beforeKey) || occupied.has(afterKey)) return;
            let intersections = 0;
            let valid = true;
            word.answer.split("").forEach((character, index) => {
              const checkRow = row + (direction === "down" ? index : 0);
              const checkCol = col + (direction === "across" ? index : 0);
              const current = occupied.get(cellKey(checkRow, checkCol));
              if (current) {
                if (
                  current.letter !== character ||
                  (direction === "across" && current.across) ||
                  (direction === "down" && current.down)
                ) valid = false;
                else intersections += 1;
                return;
              }
              const neighborA =
                direction === "across"
                  ? cellKey(checkRow - 1, checkCol)
                  : cellKey(checkRow, checkCol - 1);
              const neighborB =
                direction === "across"
                  ? cellKey(checkRow + 1, checkCol)
                  : cellKey(checkRow, checkCol + 1);
              if (occupied.has(neighborA) || occupied.has(neighborB)) valid = false;
            });
            if (!valid || intersections === 0) return;
            const score =
              intersections * 100 -
              Math.abs(row - center) -
              Math.abs(col - center);
            if (!best || score > best.score) best = { row, col, direction, score };
          });
        });
      }
      if (best) place(word, best.row, best.col, best.direction);
    }
    return rawPlaced;
  };

  const layoutArea = (placedWords: RawPlacedWord[]) => {
    const rows = placedWords.flatMap((word) => [
      word.row,
      word.row + (word.direction === "down" ? word.answer.length - 1 : 0),
    ]);
    const cols = placedWords.flatMap((word) => [
      word.col,
      word.col + (word.direction === "across" ? word.answer.length - 1 : 0),
    ]);
    return (Math.max(...rows) - Math.min(...rows) + 1) *
      (Math.max(...cols) - Math.min(...cols) + 1);
  };

  let rawPlaced: RawPlacedWord[] = [];
  const attempts = Math.min(64, Math.max(24, prepared.length * 3));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = attemptLayout(createOrder(attempt));
    if (
      candidate.length > rawPlaced.length ||
      (candidate.length === rawPlaced.length &&
        (!rawPlaced.length || layoutArea(candidate) < layoutArea(rawPlaced)))
    ) {
      rawPlaced = candidate;
    }
    if (rawPlaced.length === prepared.length) break;
  }

  const minRow = Math.min(...rawPlaced.map((word) => word.row));
  const minCol = Math.min(...rawPlaced.map((word) => word.col));
  const maxRow = Math.max(
    ...rawPlaced.map((word) =>
      word.row + (word.direction === "down" ? word.answer.length - 1 : 0),
    ),
  );
  const maxCol = Math.max(
    ...rawPlaced.map((word) =>
      word.col + (word.direction === "across" ? word.answer.length - 1 : 0),
    ),
  );
  const startNumbers = new Map<string, number>();
  let nextNumber = 1;
  rawPlaced
    .slice()
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .forEach((word) => {
      const key = cellKey(word.row, word.col);
      if (!startNumbers.has(key)) startNumbers.set(key, nextNumber++);
    });
  const placed: PlacedWord[] = rawPlaced.map((word) => ({
    id: word.id,
    answer: word.answer,
    clue: word.clue,
    row: word.row - minRow,
    col: word.col - minCol,
    direction: word.direction,
    number: startNumbers.get(cellKey(word.row, word.col)) || 0,
  }));
  const cells: Record<string, GridCell> = {};
  for (const word of placed) {
    word.answer.split("").forEach((letter, index) => {
      const row = word.row + (word.direction === "down" ? index : 0);
      const col = word.col + (word.direction === "across" ? index : 0);
      const key = cellKey(row, col);
      cells[key] = {
        row,
        col,
        letter,
        wordIds: [...(cells[key]?.wordIds || []), word.id],
        number: index === 0 ? word.number : cells[key]?.number,
      };
    });
  }
  return {
    cells,
    placed: placed.sort(
      (a, b) => a.number - b.number || (a.direction === "across" ? -1 : 1),
    ),
    rows: maxRow - minRow + 1,
    cols: maxCol - minCol + 1,
  };
}

export function mergePuzzles(imported: PuzzleDefinition[]) {
  const merged = new Map(DEFAULT_PUZZLES.map((puzzle) => [puzzle.id, puzzle]));
  imported.forEach((puzzle) => merged.set(puzzle.id, puzzle));
  return Array.from(merged.values());
}

export function normalizePuzzles(value: unknown): PuzzleDefinition[] {
  const list = Array.isArray(value) ? value : [value];
  return list.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error("Тема №" + (index + 1) + " должна быть объектом.");
    }
    const raw = item as Partial<PuzzleDefinition>;
    if (!raw.id || !raw.title || !Array.isArray(raw.words)) {
      throw new Error("Нужны поля id, title и массив words.");
    }
    const words = raw.words.map((word, wordIndex) => {
      if (!word?.answer || !word?.clue) {
        throw new Error("У слова №" + (wordIndex + 1) + " нет answer или clue.");
      }
      return { answer: cleanAnswer(String(word.answer)), clue: String(word.clue) };
    });
    if (words.length < 2) throw new Error("Добавьте минимум два слова.");
    return {
      id: String(raw.id).replace(/[^a-zA-Z0-9_-]/g, "-"),
      title: String(raw.title),
      description: String(raw.description || "Авторский кроссворд"),
      emoji: String(raw.emoji || "✦"),
      words,
    };
  });
}
