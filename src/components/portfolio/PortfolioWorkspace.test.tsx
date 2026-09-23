// @vitest-environment jsdom
import { afterEach,it,expect } from 'vitest';
import { cleanup,render,screen,fireEvent,waitFor } from '@testing-library/react';
import { PortfolioWorkspacePanel } from './PortfolioWorkspace';
import { portfolioFixture, portfolioFixtureInput, portfolioFixtureProjection } from '../../services/portfolio.fixture';
import { PORTFOLIO_STORAGE_KEY } from '../../services/portfolioRepository';
import { claimTime as at } from '../../services/verifiedClaim.fixture';
import { projectPortfolio } from '../../../shared/portfolio.mjs';
import { canonicalJson } from '../../../shared/canonical-json.mjs';
afterEach(()=>{cleanup();localStorage.clear();});
it('disconnected read shows unknown and creates no synthetic positions',async()=>{render(<PortfolioWorkspacePanel owners={{scope:'real',expressions(){throw Error('missing');}}} read={async()=>{throw Error('not connected');}}/>);await screen.findByText(/持仓数量和总额未知/);expect(localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();expect(screen.queryByRole('button',{name:'预览目标配置'})).toBeNull();});
it('target UI requires entered weights and explicit confirmation; history survives reload',async()=>{const f=await portfolioFixture(),read=async()=>f.projection,clock=()=>new Date(at(12));render(<PortfolioWorkspacePanel owners={f.owners} read={read} clock={clock}/>);await screen.findByText('2 个已记录仓位',{exact:false});fireEvent.change(screen.getByLabelText('币种与快照范围'),{target:{value:canonicalJson(['CNY',f.projection.positions[0].snapshotDate])}});expect((screen.getByLabelText('a 目标比例') as HTMLInputElement).value).toBe('');fireEvent.change(screen.getByLabelText('a 目标比例'),{target:{value:'50'}});fireEvent.change(screen.getByLabelText('b 目标比例'),{target:{value:'50'}});fireEvent.change(screen.getByLabelText('配置理由'),{target:{value:'Synthetic UI target'}});fireEvent.click(screen.getByRole('button',{name:'预览目标配置'}));expect(localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'本人确认保存'}));await waitFor(()=>expect(JSON.parse(localStorage.getItem(PORTFOLIO_STORAGE_KEY)!).targets).toHaveLength(1));await screen.findByText('配置版本历史（1）');});
it('link UI resolves exact original research; preview itself writes nothing',async()=>{const f=await portfolioFixture();render(<PortfolioWorkspacePanel owners={f.owners} read={async()=>f.projection} clock={()=>new Date(at(12))}/>);await screen.findByText('2 个已记录仓位',{exact:false});fireEvent.change(screen.getByLabelText('仓位'),{target:{value:f.link.positionId}});fireEvent.change(screen.getByLabelText('正式研究表达'),{target:{value:f.expression.revisionId}});fireEvent.change(screen.getByLabelText('关联理由'),{target:{value:'Synthetic explicit relationship'}});fireEvent.click(screen.getByRole('button',{name:'预览研究关联'}));expect(localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'本人确认保存'}));await waitFor(()=>expect(JSON.parse(localStorage.getItem(PORTFOLIO_STORAGE_KEY)!).links[0].expression).toEqual(f.link.expression));});
it('future-version storage stays locked without resetting bytes',async()=>{const f=await portfolioFixture(),raw='{"schemaVersion":"portfolio-planning.v99"}';localStorage.setItem(PORTFOLIO_STORAGE_KEY,raw);render(<PortfolioWorkspacePanel owners={f.owners} read={async()=>f.projection}/>);await screen.findByText(/写入已锁定/);expect(localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBe(raw);});
it('conflicted projection reports unknown position count instead of zero holdings',async()=>{const f=await portfolioFixture(),input=portfolioFixtureInput();input.snapshots.push({...input.snapshots[0],snapshotId:'conflict'});render(<PortfolioWorkspacePanel owners={f.owners} read={async()=>projectPortfolio(input,at(12))}/>);await screen.findByText(/仓位数量未知/);expect(screen.queryByText(/0 个已记录仓位/)).toBeNull();});

it.each(['active','inactive','archived'] as const)('UI displays original account %s and explicit denominator treatment',async(status)=>{
  const f=await portfolioFixture();render(<PortfolioWorkspacePanel owners={f.owners} read={async()=>portfolioFixtureProjection(at(12),status)}/>);
  await screen.findByText(/2 个已记录仓位/);
  expect(screen.getAllByText(new RegExp(`账户状态：.*${status}`))).toHaveLength(2);
  expect(screen.queryAllByText(/持仓仍计入已记录仓位分母，账户状态阻断需复核/)).toHaveLength(status==='active'?0:2);
});
it('corrupted read model fails closed before rendering any position or planning form',async()=>{
  const f=await portfolioFixture();f.projection.positions[0].quantity++;
  render(<PortfolioWorkspacePanel owners={f.owners} read={async()=>f.projection}/>);
  await screen.findByText(/持仓数量和总额未知/);expect(screen.queryByText('合成资产 a')).toBeNull();
  expect(screen.queryByRole('button',{name:'预览目标配置'})).toBeNull();expect(localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();
});
