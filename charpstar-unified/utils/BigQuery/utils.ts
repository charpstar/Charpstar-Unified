export const getEventsTableName = ({
  projectId,
  datasetId,
}: {
  projectId: string;
  datasetId: string;
}) => `\`${projectId}.${datasetId}.events_*\``;

export const getEventsBetween = ({
  startTableName,
  endTableName,
}: {
  startTableName: string;
  endTableName: string;
}) => `_TABLE_SUFFIX BETWEEN '${startTableName}' AND '${endTableName}'`;

export function compToBq(date: string) {
  return date.replace(/-/g, "");
}
