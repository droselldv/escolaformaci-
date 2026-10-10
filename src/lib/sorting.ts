import { ProcessedGuest, SortKey } from '../types';

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
        const nameA = a.name.trim().toLowerCase();
        const nameB = b.name.trim().toLowerCase();
        result = nameA.localeCompare(nameB, 'ca', { sensitivity: 'base' });
        break;
      }

      case 'alpha_lastname': {
        const lnA = (a.last_name || a.name.split(' ').slice(1).join(' ')).trim().toLowerCase();
        const lnB = (b.last_name || b.name.split(' ').slice(1).join(' ')).trim().toLowerCase();
        result = lnA.localeCompare(lnB, 'ca', { sensitivity: 'base' });
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
