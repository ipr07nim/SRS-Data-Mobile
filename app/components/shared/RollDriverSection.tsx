import { Block, BlockHeader, BlockTitle } from 'konsta/react';
import { formatDriverBuggy } from '../../domain/rolls';

interface RollDriverSectionProps {
  driver: string;
  buggy: string;
}

export function RollDriverSection({ driver, buggy }: RollDriverSectionProps) {
  return (
    <Block strong insetMaterial outlineIos className="!my-0">
      <BlockTitle className="!mt-0">Driver</BlockTitle>
      <BlockHeader>{formatDriverBuggy(driver, buggy)}</BlockHeader>
    </Block>
  );
}
