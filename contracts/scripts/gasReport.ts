import { ethers } from "hardhat";

/**
 * Measures the gas each record actually costs, by performing every operation
 * once against a fresh in-process chain. The numbers are what the cost section
 * of the documentation quotes; re-run to reproduce:
 *
 *   npm run gas
 */

const id = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const LAT = 18_530_800;
const LNG = 73_847_800;

async function gasOf(tx: Promise<any>): Promise<bigint> {
  const receipt = await (await tx).wait();
  return receipt.gasUsed as bigint;
}

async function main() {
  const [admin, police, lab, prosecutor, judge, keeper, accused] = await ethers.getSigners();
  const rows: [string, string, bigint][] = [];

  const evidence = (await (await ethers.getContractFactory("EvidenceChain")).deploy(admin.address)) as any;
  await evidence.grantRole(await evidence.POLICE_ROLE(), police.address);
  await evidence.grantRole(await evidence.FORENSIC_ROLE(), lab.address);
  await evidence.grantRole(await evidence.PROSECUTOR_ROLE(), prosecutor.address);
  const scene = await evidence.STAGE_SCENE();
  const forensic = await evidence.STAGE_FORENSIC_LAB();
  const pros = await evidence.STAGE_PROSECUTOR();
  const file = ethers.sha256(ethers.toUtf8Bytes("exhibit-1.jpg"));

  rows.push(["EvidenceChain", "registerEvidence (first item)", await gasOf(evidence.connect(police).registerEvidence(id("case-1"), file, LAT, LNG, id("officer")))]);
  rows.push(["EvidenceChain", "registerEvidence (typical)", await gasOf(evidence.connect(police).registerEvidence(id("case-1"), ethers.sha256(ethers.toUtf8Bytes("exhibit-2.jpg")), LAT, LNG, id("officer")))]);
  rows.push(["EvidenceChain", "transferCustody, scene → laboratory", await gasOf(evidence.connect(lab).transferCustody(1n, scene, forensic, file))]);
  rows.push(["EvidenceChain", "transferCustody, laboratory → prosecution", await gasOf(evidence.connect(prosecutor).transferCustody(1n, forensic, pros, file))]);

  const summons = (await (await ethers.getContractFactory("SummonsChain")).deploy(admin.address)) as any;
  await summons.grantRole(await summons.JUDGE_ROLE(), judge.address);
  await summons.grantRole(await summons.KEEPER_ROLE(), keeper.address);
  const expiry = (await ethers.provider.getBlock("latest"))!.timestamp + 72 * 3600;
  rows.push(["SummonsChain", "issueSummons", await gasOf(summons.connect(judge).issueSummons(id("case-1"), id("accused"), id("summons.pdf"), expiry))]);
  rows.push(["SummonsChain", "confirmDelivery (with location and device)", await gasOf(summons.connect(keeper).confirmDelivery(1n, id("accused"), LAT, LNG, id("device")))]);

  const bail = (await (await ethers.getContractFactory("BailChain")).deploy(admin.address)) as any;
  await bail.grantRole(await bail.JUDGE_ROLE(), judge.address);
  await bail.grantRole(await bail.KEEPER_ROLE(), keeper.address);
  const conditions = [await bail.CONDITION_GEO_RESTRICTION(), await bail.CONDITION_PERIODIC_CHECKIN()];
  const bailExpiry = (await ethers.provider.getBlock("latest"))!.timestamp + 90 * 86400;
  rows.push(["BailChain", "setBailConditions (two conditions)", await gasOf(bail.connect(judge).setBailConditions(id("case-1"), id("accused"), conditions, bailExpiry))]);
  rows.push(["BailChain", "configureMonitoring (geo-fence)", await gasOf(bail.connect(judge).configureMonitoring(id("case-1"), LAT, LNG, 2000, 3600))]);
  rows.push(["BailChain", "weeklyCheckIn (fence computed on chain)", await gasOf(bail.connect(keeper).weeklyCheckIn(id("case-1"), id("accused"), LAT + 5_000, LNG))]);

  console.log("\n| Contract | Operation | Gas used |\n|---|---|---|");
  for (const [c, op, gas] of rows) console.log(`| ${c} | ${op} | ${gas.toLocaleString("en-IN")} |`);
  void accused;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
