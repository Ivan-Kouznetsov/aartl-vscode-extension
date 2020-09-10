import { ITypedPath, PathType } from './types/ITypedPath';
import * as jsonpath from 'jsonpath';
import { validateSorted, NotFound, validateDate } from './matchers';

export const getCommonTopLevelProperties = (objects: any[]) => {
  const props: string[] = [];

  objects.forEach((o) => {
    for (const prop in o) {
      if (!props.includes(prop)) props.push(prop);
    }
  });
  const propsToRemove: string[] = [];

  objects.forEach((o) => {
    props.forEach((p) => {
      if ((<Record<string, unknown>>o)[p] === undefined && !propsToRemove.includes(p)) propsToRemove.push(p);
    });
  });

  return props.filter((p) => !propsToRemove.includes(p));
};

export const alwaysTheSame = (values: any[]): { alwaysTheSame: boolean; value: any | undefined } => {
  if (values.length === 0) return { alwaysTheSame: false, value: undefined };
  if (values.length === 1) return { alwaysTheSame: true, value: values[0] };

  const first = values[0];

  for (const v of values) {
    if (v !== first) return { alwaysTheSame: false, value: undefined };
  }

  return { alwaysTheSame: true, value: first };
};

export const startsAt = (values: number[], proposedLowestValue: number) =>
  values.includes(proposedLowestValue) && Math.min(...values) >= proposedLowestValue;

const isSorted = (direction: string, objects: any[]) => validateSorted(direction)(objects) === NotFound;
const isDate = (objects: any[]) => validateDate()(objects) === NotFound;

export const createRules = (obj: any, path: ITypedPath): { [key: string]: string }[] => {
  const objects = jsonpath.query(obj, path.path);
  const same = alwaysTheSame(objects);
  const rules: { [key: string]: string }[] = [{ [path.path]: 'count > 0' }];

  switch (path.type) {
    case PathType.hashMap:
      // eslint-disable-next-line no-case-declarations
      const commonProps = getCommonTopLevelProperties(objects);
      commonProps.forEach((p) => {
        rules.push({ [path.path]: `each has ${p}` });
      });
      break;
    case PathType.boolean:
      if (same.alwaysTheSame) {
        rules.push({ [path.path]: same.value.toString() });
      } else {
        rules.push({ [path.path]: 'any of true false' });
      }
      break;
    case PathType.number:
      if (same.alwaysTheSame) {
        rules.push({ [path.path]: same.value.toString() });
      } else if (startsAt(<number[]>objects, 1)) {
        rules.push({ [path.path]: '>= 1' });
      } else if (startsAt(<number[]>objects, 0)) {
        rules.push({ [path.path]: '>= 0' });
      } else {
        rules.push({ [path.path]: 'is number' });
      }
      break;
    case PathType.string:
      if (isDate(objects)) {
        rules.push({ [path.path]: 'is a date' });
      } else if (same.alwaysTheSame) {
        rules.push({ [path.path]: same.value.toString() });
      } else {
        rules.push({ [path.path]: 'is text' });
      }
      break;
  }

  if (path.type === PathType.string || path.type === PathType.number) {
    if (isSorted('asc', objects)) {
      rules.push({ [path.path]: 'is sorted asc' });
    } else if (isSorted('desc', objects)) {
      rules.push({ [path.path]: 'is sorted desc' });
    }
  }

  return rules;
};

export const createRulesFromRealData = (obj: any, paths: Set<ITypedPath>): { [key: string]: string }[] => {
  const result: { [key: string]: string }[] = [];

  paths.forEach((path) => {
    const rules = createRules(obj, path);
    rules.forEach((rule) => {
      if (result.find((r) => JSON.stringify(r) === JSON.stringify(rule)) === undefined) result.push(rule);
    });
  });

  return result;
};
