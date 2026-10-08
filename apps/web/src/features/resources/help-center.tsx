'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Search,
  SearchX,
  UserRound,
  Users,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Input,
  Surface,
  Text,
} from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';
import { ContactSupport } from './resource-page';
import { HELP_CATEGORIES, HELP_GROUPS, type HelpCategory } from './help-data';

const GROUP_ICONS = {
  'getting-started': BookOpen,
  'live-quizzes': GraduationCap,
  account: UserRound,
  hosting: Users,
};

export function HelpCenter() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HelpCategory>('all');
  const [expanded, setExpanded] = useState<string[]>([]);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        search.current?.focus();
        search.current?.select();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);
  const normalizedQuery = query.toLowerCase().trim();
  const groups = HELP_GROUPS.filter(
    (group) => category === 'all' || group.id === category,
  )
    .map((group) => ({
      ...group,
      questions: group.questions.filter(({ question, answer }) =>
        `${question} ${answer}`.toLowerCase().includes(normalizedQuery),
      ),
    }))
    .filter((group) => group.questions.length > 0);
  function updateQuery(value: string) {
    setQuery(value);
    const normalized = value.toLowerCase().trim();
    setExpanded(
      normalized.length > 2
        ? HELP_GROUPS.flatMap((group) =>
            group.questions
              .filter(({ question, answer }) =>
                `${question} ${answer}`.toLowerCase().includes(normalized),
              )
              .map(({ id }) => id),
          )
        : [],
    );
  }
  return (
    <main className="min-w-0 flex-1">
      <header className="bg-surface-low px-margin-sm py-space-2xl md:px-margin">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-space-md text-center">
          <Text variant="caption" className="text-accent uppercase">
            QuizMB Help Center
          </Text>
          <Text as="h1" variant="display">
            How can we help?
          </Text>
          <Text tone="secondary">
            Find answers about your account, quizzes, live sessions, and
            participation.
          </Text>
          <div className="relative w-full">
            <label htmlFor="faq-search">
              <VisuallyHidden>Search help questions and answers</VisuallyHidden>
            </label>
            <Search
              size={20}
              aria-hidden="true"
              className="pointer-events-none absolute left-space-sm top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <Input
              ref={search}
              id="faq-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search questions, lobbies, hosting limits…"
              aria-controls="help-questions"
              className="pl-space-xl pr-space-2xl"
            />
            <Text
              as="span"
              variant="caption"
              tone="secondary"
              aria-hidden="true"
              className="pointer-events-none absolute right-space-sm top-1/2 -translate-y-1/2"
            >
              ⌘ K
            </Text>
          </div>
          <div
            role="group"
            aria-label="Help topics"
            className="flex flex-wrap justify-center gap-space-xs"
          >
            {HELP_CATEGORIES.map(({ value, label }) => (
              <Button
                key={value}
                className="rounded-pill"
                variant={category === value ? 'primary' : 'secondary'}
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-space-xl px-margin-sm py-space-xl md:px-margin lg:py-space-2xl">
        <div id="help-questions" className="space-y-space-xl">
          <Text
            variant="caption"
            tone="secondary"
            role="status"
            className="sr-only"
          >
            {groups.reduce((count, group) => count + group.questions.length, 0)}{' '}
            matching questions
          </Text>
          {groups.map(({ id, title, description, questions }) => {
            const Icon = GROUP_ICONS[id];
            return (
              <section
                key={id}
                aria-labelledby={`${id}-heading`}
                className="space-y-space-md"
              >
                <div className="flex items-center gap-space-sm">
                  <Icon aria-hidden="true" className="shrink-0 text-accent" />
                  <div>
                    <Text
                      as="h2"
                      id={`${id}-heading`}
                      variant="section-heading"
                    >
                      {title}
                    </Text>
                    <Text variant="body-secondary" tone="secondary">
                      {description}
                    </Text>
                  </div>
                </div>
                <Surface className="overflow-hidden p-0">
                  <Accordion
                    type="multiple"
                    value={expanded}
                    onValueChange={setExpanded}
                  >
                    {questions.map(({ id: questionId, question, answer }) => (
                      <AccordionItem key={questionId} value={questionId}>
                        <AccordionTrigger>{question}</AccordionTrigger>
                        <AccordionContent>
                          <Text tone="secondary">{answer}</Text>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </Surface>
              </section>
            );
          })}
          {!groups.length && (
            <Surface className="space-y-space-sm py-space-xl text-center">
              <SearchX aria-hidden="true" className="mx-auto text-accent" />
              <Text as="h2" variant="section-heading">
                No matching guidance found
              </Text>
              <Text tone="secondary">
                Try another keyword or topic, or contact us below.
              </Text>
              <Button
                variant="secondary"
                onClick={() => {
                  updateQuery('');
                  setCategory('all');
                  search.current?.focus();
                }}
              >
                Clear filters
              </Button>
            </Surface>
          )}
        </div>
        <ContactSupport title="Couldn’t find what you were looking for?">
          Contact QuizMB support for help with your account or a quiz. Include
          the error message, but never send passwords or verification codes.
        </ContactSupport>
      </div>
    </main>
  );
}
