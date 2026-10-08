'use client';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from './button';
import { Text } from './text';
import { cn } from '@/lib/utils';

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn(
        'border-b border-border-surface last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header>
      <AccordionPrimitive.Trigger asChild {...props}>
        <Button
          variant="ghost"
          icon={
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="shrink-0 transition-transform duration-(--motion-duration) group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            />
          }
          iconPosition="right"
          className={cn(
            'group h-auto min-h-control w-full justify-between rounded-none px-space-md py-space-sm text-left',
            className,
          )}
        >
          <Text as="span" variant="label">
            {children}
          </Text>
        </Button>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content {...props} className="overflow-hidden">
      <div className={cn('px-space-md pb-space-md', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}
