import { useState, useRef, useEffect, useCallback } from 'react';
import type { Template } from '../hooks/useTemplates';

export interface TemplateSelectorProps {
  templates: Template[];
  activeTemplateId: string | null;
  onSelect: (templateId: string | null) => void;
}

/**
 * Dropdown selector for choosing the active template in the editor header.
 * Matches mockup: trigger button with label + chevron, dropdown card with checkmarks.
 */
export function TemplateSelector({ templates, activeTemplateId, onSelect }: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTemplate = templates.find((t) => t.id === activeTemplateId) ?? null;
  const displayName = activeTemplate ? activeTemplate.name : 'Sin plantilla';

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = useCallback(
    (templateId: string | null) => {
      onSelect(templateId);
      setIsOpen(false);
    },
    [onSelect],
  );

  return (
    <div ref={containerRef} style={styles.container}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span style={styles.triggerLabel}>Plantilla activa:</span>
        <span style={styles.triggerValue}>{displayName}</span>
        <span style={styles.chevron} aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div style={styles.dropdown} role="listbox" aria-label="Seleccionar plantilla">
          {/* "Sin plantilla" option */}
          <button
            type="button"
            role="option"
            aria-selected={activeTemplateId === null}
            style={{
              ...styles.option,
              ...(activeTemplateId === null ? styles.optionActive : {}),
            }}
            onClick={() => handleSelect(null)}
            onMouseEnter={(e) => {
              if (activeTemplateId !== null) {
                e.currentTarget.style.backgroundColor = 'var(--accent-subtle)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTemplateId !== null) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <span style={styles.checkmark}>{activeTemplateId === null ? '✓' : ''}</span>
            <span style={styles.optionName}>Sin plantilla</span>
          </button>

          {/* Separator */}
          {templates.length > 0 && <div style={styles.separator} />}

          {/* Template options */}
          {templates.map((template) => {
            const isActive = template.id === activeTemplateId;
            return (
              <button
                key={template.id}
                type="button"
                role="option"
                aria-selected={isActive}
                style={{
                  ...styles.option,
                  ...(isActive ? styles.optionActive : {}),
                }}
                onClick={() => handleSelect(template.id)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--accent-subtle)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={styles.checkmark}>{isActive ? '✓' : ''}</span>
                <span style={styles.optionContent}>
                  <span style={styles.optionName}>{template.name}</span>
                  <span style={styles.docTypeBadge}>{template.docType}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'border-color var(--duration-fast) var(--ease-out)',
  },
  triggerLabel: {
    color: 'var(--text-tertiary)',
    fontSize: '0.8125rem',
  },
  triggerValue: {
    color: 'var(--text-primary)',
    fontWeight: 500,
    fontSize: '0.8125rem',
  },
  chevron: {
    fontSize: '0.75rem',
    color: 'var(--text-tertiary)',
    marginLeft: '0.25rem',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    minWidth: '240px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    zIndex: 100,
    padding: '0.25rem 0',
    maxHeight: '280px',
    overflowY: 'auto',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color var(--duration-fast) var(--ease-out)',
  },
  optionActive: {
    backgroundColor: 'var(--accent-subtle)',
  },
  checkmark: {
    width: '1rem',
    flexShrink: 0,
    color: 'var(--accent-default)',
    fontWeight: 700,
    fontSize: '0.875rem',
  },
  optionContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1,
    minWidth: 0,
  },
  optionName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  docTypeBadge: {
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: 'var(--accent-default)',
    backgroundColor: 'var(--accent-subtle)',
    padding: '0.125rem 0.375rem',
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--border-subtle)',
    margin: '0.25rem 0',
  },
};
