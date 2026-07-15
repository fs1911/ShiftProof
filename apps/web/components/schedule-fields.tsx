import { Field, inputClass } from "@/components/ui";
import type { RoutineFrequency } from "@/types/db";

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

/**
 * Frequency + schedule inputs shared by the create/edit routine forms.
 * All fields render together (no client JS); the server action stores only the
 * fields that match the chosen frequency:
 *   daily -> every day; weekly -> weekday; monthly -> day of month; ad_hoc -> never due.
 */
export function ScheduleFields({
  frequency = "daily",
  weekday = null,
  monthday = null,
}: {
  frequency?: RoutineFrequency;
  weekday?: number | null;
  monthday?: number | null;
}) {
  return (
    <>
      <Field label="Frequency" htmlFor="frequency">
        <select id="frequency" name="frequency" className={inputClass} defaultValue={frequency}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="ad_hoc">Ad hoc (never scheduled)</option>
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Weekday" htmlFor="schedule_weekday" hint="Used when frequency is weekly.">
          <select
            id="schedule_weekday"
            name="schedule_weekday"
            className={inputClass}
            defaultValue={String(weekday ?? 1)}
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Day of month" htmlFor="schedule_monthday" hint="1–28. Used when frequency is monthly.">
          <input
            id="schedule_monthday"
            name="schedule_monthday"
            type="number"
            min={1}
            max={28}
            defaultValue={monthday ?? 1}
            className={inputClass}
          />
        </Field>
      </div>
    </>
  );
}
