// Experiment 1 speed code: a complete preprocessing pipeline written from scratch, typed part by part.

export const speedTest = {
  title: 'Preprocessing pipeline from scratch',
  fileName: 'preprocess.py',
  parts: [
    {
      title: 'Load the raw data',
      explain: 'Five customer rows as dictionaries. None marks a missing value, exactly like an empty cell in a spreadsheet.',
      code: `rows = [
    {"age": 25, "salary": 40000, "city": "Pune"},
    {"age": None, "salary": 52000, "city": "Delhi"},
    {"age": 31, "salary": None, "city": "Pune"},
    {"age": 45, "salary": 91000, "city": "Mumbai"},
    {"age": 38, "salary": 64000, "city": None},
]
print("rows:", len(rows))`,
    },
    {
      title: 'Fill missing numbers with the median',
      explain: 'The median ignores extreme values, so one very high salary cannot drag the filled value upwards.',
      code: `def median(values):
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def fill_missing(rows, column):
    known = [row[column] for row in rows if row[column] is not None]
    value = median(known)
    for row in rows:
        if row[column] is None:
            row[column] = value
    return value`,
    },
    {
      title: 'Fill missing categories with the mode',
      explain: 'Text columns have no median. The most frequent category (the mode) is the usual choice instead.',
      code: `def most_common(values):
    counts = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return max(counts, key=counts.get)`,
    },
    {
      title: 'Scale the numeric columns',
      explain: 'Min-max scaling squeezes values into 0 to 1. Standardizing gives mean 0 and standard deviation 1.',
      code: `def min_max(values):
    lo, hi = min(values), max(values)
    return [(v - lo) / (hi - lo) for v in values]


def standardize(values):
    mean = sum(values) / len(values)
    std = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5
    return [(v - mean) / std for v in values]`,
    },
    {
      title: 'One-hot encode the city',
      explain: 'Models need numbers, so each city becomes its own 0/1 column.',
      code: `def one_hot(values):
    categories = sorted(set(values))
    encoded = [[1 if v == c else 0 for c in categories] for v in values]
    return encoded, categories`,
    },
    {
      title: 'Run the whole pipeline',
      explain: 'Fill, scale and encode in order, then print the clean table the model would train on.',
      code: `print("age filled with", fill_missing(rows, "age"))
print("salary filled with", fill_missing(rows, "salary"))
top_city = most_common([row["city"] for row in rows if row["city"] is not None])
for row in rows:
    if row["city"] is None:
        row["city"] = top_city

ages = min_max([row["age"] for row in rows])
salaries = standardize([row["salary"] for row in rows])
cities, categories = one_hot([row["city"] for row in rows])
print("columns:", ["age", "salary"] + categories)
for age, salary, city in zip(ages, salaries, cities):
    print(round(age, 2), round(salary, 2), city)`,
    },
  ],
}
