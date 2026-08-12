

import {
  useCallback,
  useEffect,
  useState,
}                          from 'react';
import type {
  ClassLevel,
  Department,
}                          from '../types/exam';


// ── CONSTANTS ─────────────────────────────────────────────────────

/**
 * The class name prefix that triggers the department lock.
 * Defined here so the rule is visible in one place.
 * If the school adds a new junior tier in the future,
 * add its prefix to this array.
 */
const JUNIOR_CLASS_PREFIXES: ReadonlyArray<string> = ['JSS'];

/**
 * The exact department name that JSS students must be placed in.
 * Must match the value stored in the departments table exactly
 * (case-insensitive comparison is used in the lookup below).
 */
const GENERAL_DEPARTMENT_NAME = 'General';


// ── RETURN TYPE ────────────────────────────────────────────────────

export interface CurriculumConstraintResult {
  /**
   * The effective department_id to bind to the department select
   * value prop. When a JSS class is selected this is automatically
   * set to the General department's ID. When unlocked it reflects
   * whatever the user has selected via setDeptId().
   */
  effectiveDeptId    : string;

  /**
   * TRUE when the selected class is JSS1, JSS2, or JSS3.
   * Pass directly as the `disabled` prop on the department dropdown.
   * When true, the dropdown is visible but non-interactive.
   */
  isDepartmentLocked : boolean;

  /**
   * A human-readable explanation of why the department is locked.
   * Render this in an amber warning banner below the dropdown.
   * NULL when the department is not locked — nothing should render.
   */
  lockReason         : string | null;

  /**
   * Setter for the department value. Safe to call unconditionally
   * in the dropdown onChange — when isDepartmentLocked is true
   * this function silently discards the new value and keeps the
   * General department selected. When unlocked it behaves as a
   * normal state setter.
   */
  setDeptId          : (value: string) => void;
}


// ── PURE HELPER FUNCTIONS ─────────────────────────────────────────
// Defined outside the hook so they are not recreated on every render.

/**
 * isJuniorClassName
 * Returns true if the class name starts with any junior prefix.
 *
 * @param name - The class name string e.g. 'JSS1', 'SS2'
 */
function isJuniorClassName(name: string): boolean {
  const upper = name.trim().toUpperCase();
  return JUNIOR_CLASS_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

/**
 * isGeneralDeptName
 * Returns true if the department name matches 'General'
 * (case-insensitive).
 *
 * @param name - The department name string e.g. 'General', 'Science'
 */
function isGeneralDeptName(name: string): boolean {
  return name.trim().toLowerCase() === GENERAL_DEPARTMENT_NAME.toLowerCase();
}


// ── HOOK ──────────────────────────────────────────────────────────

/**
 * useCurriculumConstraint
 *
 * @param classId     - The currently selected class_id string from
 *                      the form state. Empty string means nothing
 *                      is selected yet.
 * @param classes     - Full ClassLevel[] array from the shared
 *                      classes API. Used to resolve classId → name.
 * @param departments - Full Department[] array from the shared
 *                      departments API. Used to find the General
 *                      department's ID.
 *
 * @returns CurriculumConstraintResult
 */
export function useCurriculumConstraint(
  classId    : string,
  classes    : ClassLevel[],
  departments: Department[],
): CurriculumConstraintResult {

  const [deptId, setDeptIdInternal] = useState<string>('');


  // ── DERIVED: Resolve selected class object ─────────────────────
  // Find the ClassLevel record whose id matches the current classId
  // string. Undefined means no class is selected yet.
  const selectedClass: ClassLevel | undefined = classes.find(
    (c) => String(c.id) === classId
  );

  // TRUE when the selected class name starts with 'JSS'
  const isJssSelected: boolean =
    selectedClass !== undefined &&
    isJuniorClassName(selectedClass.name);

  // ── DERIVED: Resolve General department record ─────────────────
  // Find the Department record whose name is 'General'.
  // We look this up from the departments array rather than
  // hardcoding an ID because department IDs can vary between
  // database installations.
  const generalDept: Department | undefined = departments.find(
    (d) => isGeneralDeptName(d.name)
  );

  const generalDeptId: string =
    generalDept !== undefined ? String(generalDept.id) : '';


  // ── EFFECT 1: Lock to General when JSS class is selected ────────
  // Runs whenever isJssSelected changes to true or when the
  // General department record becomes available.
  // Forces the internal deptId to the General department's ID.
  useEffect((): void => {
    if (isJssSelected && generalDeptId !== '') {
      setDeptIdInternal(generalDeptId);
    }
  }, [isJssSelected, generalDeptId]);


  // ── EFFECT 2: Unlock when switching to SS or no class ──────────
  // When the teacher changes the class from JSS to SS, the
  // department lock is lifted. We reset effectiveDeptId to ''
  // so the teacher must actively choose a department for the
  // SS student rather than having General silently persist.
  //
  // The condition checks that:
  //   — The class is NOT a JSS class (or nothing is selected)
  //   — The current deptId equals the General dept ID
  //     (meaning it was auto-set by the lock, not manually chosen)
  // This prevents accidentally clearing a General selection that
  // the teacher made intentionally for an SS student.
  useEffect((): void => {
    if (
      !isJssSelected       &&
      generalDeptId !== '' &&
      deptId        === generalDeptId
    ) {
      setDeptIdInternal('');
    }
  }, [isJssSelected, generalDeptId]);
  // Note: deptId deliberately excluded from deps here —
  // we only want this to fire when the JSS lock state changes,
  // not on every deptId change.


  // ── PUBLIC SETTER ──────────────────────────────────────────────
  // Wrapped in useCallback so the reference is stable across
  // renders. Consumer components that include setDeptId in
  // their own useEffect dependency arrays will not re-fire
  // unnecessarily.
  const setDeptId = useCallback(
    (value: string): void => {
      if (isJssSelected && generalDeptId !== '') {
        // Silently discard the attempted value and keep General.
        // This handles the edge case where a programmatic call
        // tries to set a non-General department for a JSS student.
        setDeptIdInternal(generalDeptId);
        return;
      }
      setDeptIdInternal(value);
    },
    [isJssSelected, generalDeptId]
  );


  // ── BUILD LOCK REASON STRING ───────────────────────────────────
  // The lockReason is a complete sentence ready to render in the UI.
  // It references the specific class name so the teacher understands
  // exactly which class triggered the lock.
  const lockReason: string | null = isJssSelected && selectedClass !== undefined
    ? (
        `${selectedClass.name} is a Junior Secondary class. ` +
        `Junior Secondary students are automatically placed in the ` +
        `General curriculum track. Specialised tracks (Science, Art, ` +
        `Commercial) only apply to Senior Secondary students (SS1–SS3).`
      )
    : null;


  // ── RETURN ────────────────────────────────────────────────────
  return {
    effectiveDeptId   : deptId,
    isDepartmentLocked: isJssSelected,
    lockReason,
    setDeptId,
  };
}

export default useCurriculumConstraint;