import {Component, Input} from '@angular/core';
import {animate, state, style, transition, trigger} from "@angular/animations";
import {NgIf} from "@angular/common";

@Component({
    selector: 'app-collapsible-span',
    standalone: true,
    templateUrl: './collapsible-span.component.html',
    styleUrls: ['./collapsible-span.component.scss'],
    imports: [
        NgIf
    ],
    animations: [
        trigger('slideInOut', [
            state('collapsed', style({
                height: '0px',
                opacity: 0,
                overflow: 'hidden'
            })),
            state('expanded', style({
                height: '*',
                opacity: 1,
                overflow: 'hidden'
            })),
            transition('collapsed <=> expanded', animate('300ms ease-in-out'))
        ])
    ]
})
export class CollapsibleSpanComponent {

    @Input() title: string | undefined;

    isExpanded: boolean = false;

    toggle() {
        this.isExpanded = !this.isExpanded;
    }

    get contentState() {
        return this.isExpanded ? 'expanded' : 'collapsed';
    }
}
