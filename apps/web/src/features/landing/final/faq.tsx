import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Surface,
  Text,
} from '@/components/ui';
import { APP_LINKS } from '@/config/navigation';
import { FAQ } from '../content';
import { Eyebrow } from '../sections';

/** The FAQ, in the Help Center's accordion. */
export function FinalFaq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="mx-auto w-full max-w-content scroll-mt-20 px-margin-sm md:px-margin lg:px-space-xl"
    >
      <div className="grid gap-space-xl lg:grid-cols-[1fr_1.6fr]">
        {/* Centred like the other section headings until the two columns. */}
        <div className="space-y-space-xs max-lg:mx-auto max-lg:max-w-2xl max-lg:text-center">
          <Eyebrow>Questions</Eyebrow>
          <Text
            as="h2"
            id="faq-title"
            variant="display"
            className="text-balance"
          >
            Good to know before your first session.
          </Text>
          <Text tone="secondary" className="text-pretty">
            Still unsure? The Help Center covers hosting, joining and limits in
            detail.
          </Text>
          <Link
            href={APP_LINKS.FOOTER.HELP}
            target="_blank"
            rel="noopener noreferrer"
            className="ds-focus mt-space-xs inline-flex min-h-6 items-center gap-1 py-1 text-label text-accent underline-offset-4 hover:underline"
          >
            Visit the Help Center
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <Surface className="overflow-hidden p-0">
          <Accordion type="single" collapsible>
            {FAQ.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>
                  <Text tone="secondary">
                    {item.answer}{' '}
                    {item.question === 'Is it free?' && (
                      <Link
                        href={APP_LINKS.LEGAL.FAIR_USE}
                        className="ds-focus text-accent underline underline-offset-2"
                      >
                        See the fair-use limits.
                      </Link>
                    )}
                  </Text>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Surface>
      </div>
    </section>
  );
}
