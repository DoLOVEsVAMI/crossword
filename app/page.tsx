"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  Lightbulb,
  RotateCcw,
  Settings2,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildCrossword,
  cellKey,
  cleanAnswer,
  DEFAULT_PUZZLES,
  type Direction,
  type GridCell,
  mergePuzzles,
  normalizePuzzles,
  type PlacedWord,
  type PuzzleDefinition,
  SAMPLE_JSON,
} from "@/lib/crossword";

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

type WebMcpDocument = Document & {
  modelContext?: {
    registerTool: (
      tool: WebMcpTool,
      options?: { signal?: AbortSignal },
    ) => void | Promise<void>;
  };
};

function playTone(
  kind: "tap" | "word" | "success" | "error",
  enabled: boolean,
) {
  if (!enabled || typeof window === "undefined") return;
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const now = context.currentTime;
  const notes =
    kind === "success"
      ? [659, 784, 988]
      : kind === "word"
        ? [523, 659]
        : kind === "error"
          ? [170, 135]
          : [360];
  const step = kind === "tap" ? 0 : 0.085;
  const duration = kind === "tap" ? 0.075 : 0.19;

  void context.resume();
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * step;
    oscillator.type = kind === "error" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      kind === "tap" ? 0.025 : 0.065,
      start + 0.012,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  });

  window.setTimeout(
    () => void context.close(),
    Math.ceil((notes.length * step + duration + 0.08) * 1000),
  );
}

function getPuzzleVersion(puzzle: PuzzleDefinition) {
  const source = puzzle.words.map((word) => cleanAnswer(word.answer)).join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export default function Home() {
  const [importedPuzzles, setImportedPuzzles] = useState<PuzzleDefinition[]>([]);
  const [currentPuzzleId, setCurrentPuzzleId] = useState(DEFAULT_PUZZLES[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedWordId, setSelectedWordId] = useState("");
  const [focusedCellKey, setFocusedCellKey] = useState("");
  const [hintsLeft, setHintsLeft] = useState(3);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState("Прогресс сохраняется автоматически");
  const [loadedPuzzleKey, setLoadedPuzzleKey] = useState("");
  const [adminText, setAdminText] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [cluePickerOpen, setCluePickerOpen] = useState(false);
  const puzzles = useMemo(() => mergePuzzles(importedPuzzles), [importedPuzzles]);
  const currentPuzzle =
    puzzles.find((puzzle) => puzzle.id === currentPuzzleId) || puzzles[0];
  const grid = useMemo(() => buildCrossword(currentPuzzle.words), [currentPuzzle]);
  const currentPuzzleVersion = useMemo(
    () => getPuzzleVersion(currentPuzzle),
    [currentPuzzle],
  );
  const progressStorageKey = useMemo(
    () =>
      "pink-crossword-progress-v2:" +
      currentPuzzle.id +
      ":" +
      currentPuzzleVersion,
    [currentPuzzle.id, currentPuzzleVersion],
  );
  const canUseLegacyProgress = useMemo(
    () =>
      DEFAULT_PUZZLES.some(
        (puzzle) =>
          puzzle.id === currentPuzzle.id &&
          getPuzzleVersion(puzzle) === currentPuzzleVersion,
      ),
    [currentPuzzle.id, currentPuzzleVersion],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const storedPuzzles = localStorage.getItem("pink-crossword-puzzles-v1");
        if (storedPuzzles) {
          setImportedPuzzles(normalizePuzzles(JSON.parse(storedPuzzles)));
        }
        setSoundEnabled(localStorage.getItem("pink-crossword-sound-v1") !== "off");
      } catch {
        setAdminMessage("Не удалось прочитать сохранённые темы.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const raw =
        localStorage.getItem(progressStorageKey) ??
        (canUseLegacyProgress
          ? localStorage.getItem("pink-crossword-progress-v1:" + currentPuzzle.id)
          : null);
      try {
        const saved = raw ? JSON.parse(raw) : null;
        setValues(saved?.values || {});
        setHintsLeft(typeof saved?.hintsLeft === "number" ? saved.hintsLeft : 3);
      } catch {
        setValues({});
        setHintsLeft(3);
      }
      setChecked(false);
      setLoadedPuzzleKey(progressStorageKey);
      setSelectedWordId(grid.placed[0]?.id || "");
      setFocusedCellKey("");
      setStatus("Прогресс сохраняется автоматически");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [canUseLegacyProgress, currentPuzzle.id, grid.placed, progressStorageKey]);

  useEffect(() => {
    if (loadedPuzzleKey !== progressStorageKey) return;
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({ values, hintsLeft }),
    );
  }, [values, hintsLeft, loadedPuzzleKey, progressStorageKey]);

  const totalCells = Object.keys(grid.cells).length;
  const correctCells = Object.entries(grid.cells).filter(
    ([key, cell]) => values[key] === cell.letter,
  ).length;
  const progress = totalCells ? Math.round((correctCells / totalCells) * 100) : 0;
  const selectedWord =
    grid.placed.find((word) => word.id === selectedWordId) || grid.placed[0];
  const selectedWordIndex = selectedWord
    ? grid.placed.findIndex((word) => word.id === selectedWord.id)
    : -1;
  const wordCells = (word: PlacedWord) =>
    word.answer.split("").map((_, index) => ({
      row: word.row + (word.direction === "down" ? index : 0),
      col: word.col + (word.direction === "across" ? index : 0),
    }));

  const revealCell = (row: number, col: number, shouldFocus: boolean) => {
    const key = cellKey(row, col);
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        '[data-cell="' + key + '"]',
      );
      const scroller = input?.closest<HTMLElement>(".grid-scroll");
      const cell = input?.closest<HTMLElement>(".crossword-cell");
      if (input && cell && scroller) {
        scroller.scrollTo({
          left:
            cell.offsetLeft + cell.offsetWidth / 2 - scroller.clientWidth / 2,
          behavior: "smooth",
        });
      }
      if (shouldFocus) {
        input?.focus({ preventScroll: true });
        input?.select();
      }
    });
  };

  const focusCell = (row: number, col: number) => {
    setFocusedCellKey(cellKey(row, col));
    revealCell(row, col, true);
  };

  useEffect(() => {
    const firstWord = grid.placed[0];
    if (!firstWord) return;
    const firstRow = firstWord.row;
    const firstCol = firstWord.col;
    const frameId = requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        '[data-cell="' + cellKey(firstRow, firstCol) + '"]',
      );
      const scroller = input?.closest<HTMLElement>(".grid-scroll");
      const cell = input?.closest<HTMLElement>(".crossword-cell");
      if (input && cell && scroller) {
        scroller.scrollLeft =
          cell.offsetLeft + cell.offsetWidth / 2 - scroller.clientWidth / 2;
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [grid.placed, progressStorageKey]);

  const getCellWord = (cell: GridCell) =>
    grid.placed.find(
      (item) =>
        item.id === selectedWordId && cell.wordIds.includes(item.id),
    ) || grid.placed.find((item) => cell.wordIds.includes(item.id));

  const chooseCellWord = (cell: GridCell) => {
    const nextWordId =
      cell.wordIds.length > 1 && cell.wordIds.includes(selectedWordId)
        ? cell.wordIds.find((id) => id !== selectedWordId) || cell.wordIds[0]
        : cell.wordIds[0];
    setSelectedWordId(nextWordId);
  };

  const handleCellChange = (cell: GridCell, rawValue: string) => {
    const value = cleanAnswer(rawValue).slice(-1);
    const key = cellKey(cell.row, cell.col);
    const nextValues = { ...values, [key]: value };
    const completedWord = value
      ? cell.wordIds.some((wordId) => {
          const word = grid.placed.find((item) => item.id === wordId);
          if (!word) return false;
          const wasComplete = wordCells(word).every((position) => {
            const positionKey = cellKey(position.row, position.col);
            return values[positionKey] === grid.cells[positionKey].letter;
          });
          const isComplete = wordCells(word).every((position) => {
            const positionKey = cellKey(position.row, position.col);
            return nextValues[positionKey] === grid.cells[positionKey].letter;
          });
          return isComplete && !wasComplete;
        })
      : false;

    setValues(nextValues);
    setChecked(false);
    if (completedWord) {
      setStatus("Верно! Слово разгадано ✦");
      playTone("word", soundEnabled);
    } else if (value) {
      playTone("tap", soundEnabled);
    }
    const word = getCellWord(cell);
    if (!word) return;
    const positions = wordCells(word);
    const index = positions.findIndex(
      (position) => position.row === cell.row && position.col === cell.col,
    );
    if (!value) {
      const previous = positions[index - 1];
      if (previous) focusCell(previous.row, previous.col);
      return;
    }
    const next = positions[index + 1];
    if (next) focusCell(next.row, next.col);
  };

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    cell: GridCell,
  ) => {
    const key = cellKey(cell.row, cell.col);
    if (event.key === "Backspace" && !values[key]) {
      const word = getCellWord(cell);
      if (!word) return;
      const positions = wordCells(word);
      const index = positions.findIndex(
        (position) => position.row === cell.row && position.col === cell.col,
      );
      const previous = positions[index - 1];
      if (previous) {
        event.preventDefault();
        setValues((current) => ({
          ...current,
          [cellKey(previous.row, previous.col)]: "",
        }));
        focusCell(previous.row, previous.col);
      }
      return;
    }
    if (event.key === "Delete" && values[key]) {
      event.preventDefault();
      setValues((current) => ({ ...current, [key]: "" }));
      setChecked(false);
      setStatus("Буква стёрта");
      return;
    }
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const offset = arrows[event.key];
    if (!offset) return;
    const next = grid.cells[cellKey(cell.row + offset[0], cell.col + offset[1])];
    if (next) {
      event.preventDefault();
      focusCell(next.row, next.col);
    }
  };

  const selectClue = (word: PlacedWord, shouldFocus = true) => {
    setSelectedWordId(word.id);
    setCluePickerOpen(false);
    const target =
      wordCells(word).find(
        (position) => !values[cellKey(position.row, position.col)],
      ) || wordCells(word)[0];
    setFocusedCellKey(cellKey(target.row, target.col));
    if (shouldFocus) focusCell(target.row, target.col);
    else revealCell(target.row, target.col, false);
  };

  const moveClue = (offset: number) => {
    if (!grid.placed.length) return;
    const currentIndex = selectedWordIndex < 0 ? 0 : selectedWordIndex;
    const nextIndex =
      (currentIndex + offset + grid.placed.length) % grid.placed.length;
    selectClue(grid.placed[nextIndex], false);
  };

  const checkPuzzle = () => {
    setChecked(true);
    const filled = Object.values(values).filter(Boolean).length;
    const wrong = Object.entries(grid.cells).filter(
      ([key, cell]) => Boolean(values[key]) && values[key] !== cell.letter,
    ).length;
    if (progress === 100) {
      setStatus("Готово! Кроссворд разгадан ✦");
      playTone("success", soundEnabled);
    } else if (filled === 0) {
      setStatus("Сначала впишите хотя бы одну букву");
    } else if (wrong === 0) {
      setStatus("Всё верно! Осталось заполнить остальные клетки");
      playTone("tap", soundEnabled);
    } else {
      setStatus("Почти! Ошибочные буквы отмечены розовым");
      playTone("error", soundEnabled);
    }
  };

  const useHint = () => {
    if (!selectedWord || hintsLeft < 1) return;
    const target = wordCells(selectedWord).find((position) => {
      const key = cellKey(position.row, position.col);
      return values[key] !== grid.cells[key].letter;
    });
    if (!target) {
      setStatus("Это слово уже заполнено правильно");
      return;
    }
    const key = cellKey(target.row, target.col);
    setValues((current) => ({ ...current, [key]: grid.cells[key].letter }));
    setHintsLeft((count) => count - 1);
    setChecked(false);
    setStatus("Открыли одну букву");
    playTone("success", soundEnabled);
    focusCell(target.row, target.col);
  };

  const eraseCurrentCell = () => {
    const focusedCell = focusedCellKey ? grid.cells[focusedCellKey] : undefined;
    const word = focusedCell ? getCellWord(focusedCell) : selectedWord;
    if (!word) return;
    const positions = wordCells(word);
    const focusedIndex = focusedCell
      ? positions.findIndex(
          (position) =>
            position.row === focusedCell.row && position.col === focusedCell.col,
        )
      : -1;
    const fallbackIndex = positions.reduce(
      (lastIndex, position, index) =>
        values[cellKey(position.row, position.col)] ? index : lastIndex,
      -1,
    );
    const focusedIsEmpty =
      focusedIndex >= 0 &&
      !values[cellKey(positions[focusedIndex].row, positions[focusedIndex].col)];
    const targetIndex =
      focusedIsEmpty && focusedIndex > 0
        ? focusedIndex - 1
        : focusedIndex >= 0
          ? focusedIndex
          : fallbackIndex;
    if (targetIndex < 0) {
      setStatus("В выбранном слове пока нечего стирать");
      focusCell(positions[0].row, positions[0].col);
      return;
    }
    const target = positions[targetIndex];
    const targetKey = cellKey(target.row, target.col);
    const hadValue = Boolean(values[targetKey]);
    setValues((current) => ({ ...current, [targetKey]: "" }));
    setChecked(false);
    setStatus(hadValue ? "Буква стёрта" : "В этой клетке пока нет буквы");
    const previous = positions[Math.max(0, targetIndex - 1)];
    focusCell(previous.row, previous.col);
  };

  const resetProgress = () => {
    setValues({});
    setHintsLeft(3);
    setChecked(false);
    setStatus("Можно начать заново");
    localStorage.removeItem(progressStorageKey);
    localStorage.removeItem("pink-crossword-progress-v1:" + currentPuzzle.id);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("pink-crossword-sound-v1", next ? "on" : "off");
    if (next) playTone("tap", true);
  };

  const importJson = () => {
    try {
      const nextPuzzles = normalizePuzzles(JSON.parse(adminText));
      const nextImported = [...importedPuzzles];
      nextPuzzles.forEach((puzzle) => {
        const index = nextImported.findIndex((item) => item.id === puzzle.id);
        if (index >= 0) nextImported[index] = puzzle;
        else nextImported.push(puzzle);
      });
      setImportedPuzzles(nextImported);
      localStorage.setItem("pink-crossword-puzzles-v1", JSON.stringify(nextImported));
      setCurrentPuzzleId(nextPuzzles[0].id);
      setAdminMessage(
        nextPuzzles.length === 1
          ? "Тема добавлена. Сетка заново построена по пересечениям слов."
          : "Темы добавлены. Для каждой сетка построена заново.",
      );
      setAdminText("");
    } catch (error) {
      setAdminMessage(
        error instanceof SyntaxError
          ? "JSON не удалось прочитать. Проверьте кавычки, запятые и скобки."
          : error instanceof Error
            ? error.message
            : "Проверьте формат JSON.",
      );
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAdminText(await file.text());
    setAdminMessage("Файл прочитан. Проверьте данные и нажмите «Добавить».");
    event.target.value = "";
  };

  const copySample = async () => {
    await navigator.clipboard.writeText(SAMPLE_JSON);
    setAdminMessage("Пример скопирован.");
  };

  const activeCellKeys = new Set(
    selectedWord
      ? wordCells(selectedWord).map((cell) => cellKey(cell.row, cell.col))
      : [],
  );
  const selectedWordComplete = selectedWord
    ? wordCells(selectedWord).every((position) => {
        const key = cellKey(position.row, position.col);
        return values[key] === grid.cells[key].letter;
      })
    : false;

  useEffect(() => {
    const context = (document as WebMcpDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: WebMcpTool) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {
        // Unsupported or partial WebMCP implementations should not affect play.
      }
    };

    register({
      name: "list_crossword_topics",
      title: "Список тем кроссворда",
      description: "Показывает доступные темы без изменения текущей игры.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        return {
          currentTopicId: currentPuzzle.id,
          topics: puzzles.map(({ id, title, description }) => ({
            id,
            title,
            description,
          })),
        };
      },
    });

    register({
      name: "select_crossword_topic",
      title: "Выбрать тему кроссворда",
      description:
        "Переключает видимую игру на существующую тему по её идентификатору.",
      inputSchema: {
        type: "object",
        properties: { topicId: { type: "string" } },
        required: ["topicId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const topicId =
          typeof input === "object" && input !== null
            ? (input as { topicId?: unknown }).topicId
            : undefined;
        if (
          typeof topicId !== "string" ||
          !puzzles.some((puzzle) => puzzle.id === topicId)
        ) {
          throw new Error("Неизвестная тема кроссворда.");
        }
        setCurrentPuzzleId(topicId);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return { selectedTopicId: topicId };
      },
    });

    register({
      name: "fill_crossword_cells",
      title: "Заполнить клетки кроссворда",
      description:
        "Вписывает одну или несколько букв в видимые клетки и сохраняет прогресс.",
      inputSchema: {
        type: "object",
        properties: {
          letters: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                row: { type: "integer", minimum: 0 },
                col: { type: "integer", minimum: 0 },
                letter: { type: "string", minLength: 1, maxLength: 1 },
              },
              required: ["row", "col", "letter"],
              additionalProperties: false,
            },
          },
        },
        required: ["letters"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const letters =
          typeof input === "object" && input !== null
            ? (input as { letters?: unknown }).letters
            : undefined;
        if (!Array.isArray(letters) || letters.length === 0) {
          throw new Error("Передайте непустой массив letters.");
        }
        const updates: Record<string, string> = {};
        letters.forEach((item) => {
          if (!item || typeof item !== "object") {
            throw new Error("Каждая буква должна быть объектом.");
          }
          const { row, col, letter } = item as {
            row?: unknown;
            col?: unknown;
            letter?: unknown;
          };
          if (
            !Number.isInteger(row) ||
            !Number.isInteger(col) ||
            typeof letter !== "string"
          ) {
            throw new Error("Нужны целые row, col и строка letter.");
          }
          const key = cellKey(row as number, col as number);
          if (!grid.cells[key]) throw new Error("Клетка " + key + " недоступна.");
          const cleaned = cleanAnswer(letter);
          if (cleaned.length !== 1) throw new Error("Укажите ровно одну букву.");
          updates[key] = cleaned;
        });
        setValues((current) => ({ ...current, ...updates }));
        setChecked(false);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return {
          topicId: currentPuzzle.id,
          updatedCells: Object.keys(updates).length,
        };
      },
    });

    return () => lifecycle.abort();
  }, [currentPuzzle.id, grid.cells, puzzles]);

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#" aria-label="Розовый кроссворд — на главную">
          <span className="brand-mark" aria-hidden="true">
            <span /><span /><span /><span />
          </span>
          <span><strong>Розовый</strong><small>кроссворд</small></span>
        </a>
        <div className="header-actions">
          <label className="topic-select">
            <span className="sr-only">Выбрать тему</span>
            <span className="topic-symbol" aria-hidden="true">
              {currentPuzzle.emoji || "✦"}
            </span>
            <select
              value={currentPuzzle.id}
              onChange={(event) => setCurrentPuzzleId(event.target.value)}
            >
              {puzzles.map((puzzle) => (
                <option key={puzzle.id} value={puzzle.id}>{puzzle.title}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
          <Button
            variant="ghost"
            size="icon"
            className="icon-button"
            onClick={toggleSound}
            aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
          >
            {soundEnabled ? <Volume2 /> : <VolumeX />}
          </Button>
          <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="admin-button"
                aria-label="Для автора: добавить тему из JSON"
              >
                <Settings2 /><span>Для автора</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="admin-dialog">
              <DialogHeader>
                <div className="dialog-kicker"><Sparkles />Редактор тем</div>
                <DialogTitle>Добавьте свой кроссворд</DialogTitle>
                <DialogDescription>
                  Вставьте JSON или выберите файл. Тема сохранится в этом браузере.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="import" className="admin-tabs">
                <TabsList>
                  <TabsTrigger value="import">Импорт</TabsTrigger>
                  <TabsTrigger value="format">Формат JSON</TabsTrigger>
                </TabsList>
                <TabsContent value="import">
                  <textarea
                    className="json-input"
                    value={adminText}
                    onChange={(event) => {
                      setAdminText(event.target.value);
                      setAdminMessage("");
                    }}
                    placeholder={'{\n  "id": "new-topic",\n  "title": "Новая тема",\n  "words": [...]\n}'}
                    spellCheck={false}
                    aria-label="JSON с темой кроссворда"
                  />
                  <div className="admin-row">
                    <label className="file-button">
                      <Upload />Выбрать .json
                      <input type="file" accept=".json,application/json" onChange={handleFile} />
                    </label>
                    <Button
                      onClick={importJson}
                      disabled={!adminText.trim()}
                      className="primary-button"
                    >
                      <Check />Добавить тему
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="format">
                  <div className="format-card">
                    <p>
                      Каждой теме нужны <code>id</code>, <code>title</code> и
                      массив <code>words</code>. Для слова укажите{" "}
                      <code>answer</code> и <code>clue</code>.
                    </p>
                    <pre>{SAMPLE_JSON}</pre>
                    <Button variant="outline" onClick={copySample}>
                      <Copy />Скопировать пример
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
              {adminMessage && <p className="admin-message" role="status">{adminMessage}</p>}
              <p className="admin-note">
                Для публикации темы всем посетителям добавьте этот JSON в
                исходники проекта или подключите серверное хранилище.
              </p>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="game-header" aria-labelledby="puzzle-title">
        <div>
          <p className="eyebrow"><span>{currentPuzzle.emoji || "✦"}</span>Тема дня</p>
          <h1 id="puzzle-title">{currentPuzzle.title}</h1>
          <p>{currentPuzzle.description}</p>
        </div>
        <div className="progress-card">
          <div className="progress-label">
            <span>Ваш прогресс</span><strong>{progress}%</strong>
          </div>
          <div className="progress-track" aria-label={"Решено на " + progress + "%"}>
            <span style={{ width: progress + "%" }} />
          </div>
          <small>{correctCells} из {totalCells} букв на месте</small>
        </div>
      </section>

      <section className="game-layout">
        <div className="board-card">
          {grid.cols > 16 && (
            <p className="grid-scroll-hint" aria-hidden="true">
              Проведите по сетке влево или вправо
            </p>
          )}
          <div
            className="grid-scroll"
            role="region"
            tabIndex={0}
            aria-label={"Прокручиваемое поле кроссворда «" + currentPuzzle.title + "»"}
          >
            <div
              className="crossword-grid"
              style={{
                gridTemplateColumns: "repeat(" + grid.cols + ", minmax(0, 1fr))",
                width:
                  "clamp(" +
                  grid.cols * 32 +
                  "px, 100%, " +
                  grid.cols * 48 +
                  "px)",
              }}
            >
            {Array.from({ length: grid.rows * grid.cols }).map((_, index) => {
              const row = Math.floor(index / grid.cols);
              const col = index % grid.cols;
              const key = cellKey(row, col);
              const cell = grid.cells[key];
              if (!cell) return <span className="blocked-cell" key={key} aria-hidden="true" />;
              const isWrong = checked && Boolean(values[key]) && values[key] !== cell.letter;
              const isRight = checked && values[key] === cell.letter;
              return (
                <label
                  key={key}
                  className={[
                    "crossword-cell",
                    activeCellKeys.has(key) ? "is-active" : "",
                    isWrong ? "is-wrong" : "",
                    isRight ? "is-right" : "",
                  ].join(" ")}
                  onClick={() => chooseCellWord(cell)}
                >
                  {cell.number && <span className="cell-number">{cell.number}</span>}
                  <input
                    data-cell={key}
                    value={values[key] || ""}
                    onChange={(event) => handleCellChange(cell, event.target.value)}
                    onKeyDown={(event) => handleCellKeyDown(event, cell)}
                    onFocus={() => {
                      setFocusedCellKey(key);
                      if (!cell.wordIds.includes(selectedWordId)) {
                        setSelectedWordId(cell.wordIds[0]);
                      }
                    }}
                    maxLength={1}
                    inputMode="text"
                    autoComplete="off"
                    aria-label={"Клетка " + (row + 1) + ", " + (col + 1)}
                  />
                </label>
              );
            })}
            </div>
          </div>

          {selectedWord && (
            <div className="clue-navigator" aria-label="Навигация по вопросам">
              <button
                type="button"
                className="clue-nav-button"
                onClick={() => moveClue(-1)}
                aria-label="Предыдущий вопрос"
              >
                <ChevronLeft />
              </button>

              <Dialog open={cluePickerOpen} onOpenChange={setCluePickerOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className={[
                      "current-clue",
                      selectedWordComplete ? "is-complete" : "",
                    ].join(" ")}
                    aria-label="Открыть список вопросов"
                  >
                    <span className="current-clue-number">{selectedWord.number}</span>
                    <span className="current-clue-copy">
                      <span>
                        {selectedWord.direction === "across"
                          ? "По горизонтали"
                          : "По вертикали"}
                        {" · "}
                        {selectedWordIndex + 1} из {grid.placed.length}
                      </span>
                      <strong>{selectedWord.clue}</strong>
                    </span>
                    {selectedWordComplete ? (
                      <Check className="current-clue-state is-done" aria-label="Готово" />
                    ) : (
                      <ChevronDown className="current-clue-state" aria-hidden="true" />
                    )}
                  </button>
                </DialogTrigger>
                <DialogContent className="clue-picker-dialog">
                  <DialogHeader>
                    <DialogTitle>Выберите вопрос</DialogTitle>
                    <DialogDescription>
                      Нажмите на вопрос — нужное слово подсветится в сетке.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="clue-picker-list">
                    {(["across", "down"] as Direction[]).map((direction) => {
                      const words = grid.placed.filter(
                        (word) => word.direction === direction,
                      );
                      if (!words.length) return null;
                      return (
                        <div className="clue-group" key={direction}>
                          <h3>
                            {direction === "across"
                              ? "По горизонтали"
                              : "По вертикали"}
                          </h3>
                          <div>
                            {words.map((word) => {
                              const complete = wordCells(word).every((position) => {
                                const key = cellKey(position.row, position.col);
                                return values[key] === grid.cells[key].letter;
                              });
                              return (
                                <button
                                  type="button"
                                  key={word.id}
                                  className={[
                                    "clue-item",
                                    word.id === selectedWordId ? "is-selected" : "",
                                    complete ? "is-complete" : "",
                                  ].join(" ")}
                                  onClick={() => selectClue(word, false)}
                                >
                                  <span className="clue-number">{word.number}</span>
                                  <span>{word.clue}</span>
                                  {complete && (
                                    <Check className="clue-check" aria-label="Готово" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>

              <button
                type="button"
                className="clue-nav-button"
                onClick={() => moveClue(1)}
                aria-label="Следующий вопрос"
              >
                <ChevronRight />
              </button>
            </div>
          )}

          <div className="board-footer">
            <div className="board-status">
              <p role="status" aria-live="polite">
                <span className="status-dot" />{status}
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="reset-button"
                    aria-label="Сбросить прогресс"
                  >
                    <RotateCcw />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Начать заново?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Все введённые буквы в этой теме будут удалены.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={resetProgress}>Сбросить</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="board-actions">
              <Button
                variant="outline"
                onClick={eraseCurrentCell}
                className="erase-button"
              >
                <Eraser />Стереть
              </Button>
              <Button
                variant="outline"
                onClick={useHint}
                disabled={hintsLeft < 1}
                className="hint-button"
              >
                <Lightbulb />Подсказка<span>{hintsLeft}</span>
              </Button>
              <Button onClick={checkPuzzle} className="primary-button check-button">
                <Check />Проверить
              </Button>
            </div>
          </div>
        </div>
      </section>
      <footer className="page-footer">
        <span>Ваши ответы остаются только на этом устройстве</span>
        <span aria-hidden="true">✦</span>
        <span>Без регистрации</span>
      </footer>
    </main>
  );
}
