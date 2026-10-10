import { ProcessedGuest, SortKey } from '../types';

/**
 * Formats guest name starting with Surnames, then First name: "Cognoms, Nom".
 * Example: "Abad Gimeno, Ramon" or "Campanyà, Francesc".
 */
export function formatFullNameSurnamesFirst(g: {
  name?: string;
  first_name?: string;
  last_name?: string;
}): string {
  const ln = (g.last_name || '').trim();
  const fn = (g.first_name || '').trim();

  if (ln && fn) {
    return `${ln}, ${fn}`;
  }
  if (ln && !fn) {
    return ln;
  }
  const raw = (g.name || '').trim();
  if (!raw) return '-';

  if (raw.includes(',')) {
    return raw;
  }

  // If first_name is known and raw starts with it, extract remainder as surname
  if (fn && raw.toLowerCase().startsWith(fn.toLowerCase())) {
    const remainder = raw.slice(fn.length).trim();
    if (remainder) {
      return `${remainder}, ${fn}`;
    }
    return fn;
  }

  // Split by whitespace: first word as first name, rest as surnames
  const parts = raw.split(/\s+/);
  if (parts.length > 1) {
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return `${lastName}, ${firstName}`;
  }

  return raw;
}

export function sortGuests(
  guests: ProcessedGuest[],
  sortBy: SortKey,
  direction: 'asc' | 'desc' = 'asc'
): ProcessedGuest[] {
  const sorted = [...guests];

  sorted.sort((a, b) => {
    let result = 0;

    switch (sortBy) {
      case 'table_seat': {
        const tableA = a.tableNumber ?? 9999;
        const tableB = b.tableNumber ?? 9999;
        if (tableA !== tableB) {
          result = tableA - tableB;
        } else {
          result = (a.seatNumber ?? 999) - (b.seatNumber ?? 999);
        }
        break;
      }

      case 'alpha_name': {
        const fnA = (a.first_name || a.name.split(' ')[0] || '').trim().toLowerCase();
        const fnB = (b.first_name || b.name.split(' ')[0] || '').trim().toLowerCase();
        result = fnA.localeCompare(fnB, 'ca', { sensitivity: 'base' });
        if (result === 0) {
          const nameA = formatFullNameSurnamesFirst(a).toLowerCase();
          const nameB = formatFullNameSurnamesFirst(b).toLowerCase();
          result = nameA.localeCompare(nameB, 'ca', { sensitivity: 'base' });
        }
        break;
      }

      case 'alpha_lastname': {
        const nameA = formatFullNameSurnamesFirst(a).toLowerCase();
        const nameB = formatFullNameSurnamesFirst(b).toLowerCase();
        result = nameA.localeCompare(nameB, 'ca', { sensitivity: 'base' });
        break;
      }

      case 'registration_date': {
        const tA = new Date(a.created_at).getTime() || 0;
        const tB = new Date(b.created_at).getTime() || 0;
        result = tA - tB;
        break;
      }

      case 'dish': {
        result = a.cleanDish.localeCompare(b.cleanDish, 'ca', { sensitivity: 'base' });
        break;
      }

      case 'municipi': {
        const mA = (a.municipi || '').trim().toLowerCase();
        const mB = (b.municipi || '').trim().toLowerCase();
        result = mA.localeCompare(mB, 'ca', { sensitivity: 'base' });
        break;
      }

      case 'comarca': {
        const cA = (a.comarca || '').trim().toLowerCase();
        const cB = (b.comarca || '').trim().toLowerCase();
        result = cA.localeCompare(cB, 'ca', { sensitivity: 'base' });
        break;
      }

      default:
        result = 0;
    }

    return direction === 'desc' ? -result : result;
  });

  return sorted;
}
