export type RootStackParams = {
  Tabs: undefined;
  Round: { roundId: number };
  RoundReview: { roundId: number };
  Session: { dayIndex: number };
  Drill: { drillId: string };
  AddCourse: { courseId?: string } | undefined;
};
export type TabParams = {
  Home: undefined;
  Coach: undefined;
  Play: undefined;
  Fitness: undefined;
  MyGame: undefined;
};
